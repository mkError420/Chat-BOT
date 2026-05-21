import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// In-Memory Storage
let chatSessions: { [id: string]: any } = {};
let nextSessionId = 1;
let nextMessageId = 1;

let knowledgeConfig = {
  hospitalName: "Rangpur Community Medical College & Hospital (RCMC & RCMCH)",
  aboutText: "Rangpur Community Medical College (RCMC) and the 750-bedded RCMC Hospital are premium medical institutions located in Rangpur, Bangladesh. Established to deliver world-class medical education, research, and healthcare services, RCMC offers state-of-the-art facilities for local and international students. Its clinical partner, RCMCH, is one of the largest private medical college hospitals in the northern region of Bangladesh.",
  admissionInfo: `1. MBBS (Bachelor of Medicine and Bachelor of Surgery): A 5-year academic program with a compulsory 1-year logbook-based rotating internship. Approved by BMDC (Bangladesh Medical & Dental Council) and affiliated with Rajshahi Medical University.
2. BDS (Bachelor of Dental Surgery): A 4-year professional medical degree followed by a 1-year internship.
3. Nursing Courses: Offered via Rangpur Community Nursing College (B.Sc. in Nursing, Post Basic B.Sc. in Nursing, and Diploma in Nursing Science & Midwifery).
4. International Admission: RCMC is a popular hub for students from India, Nepal, Bhutan, and other South Asian nations. Direct admission is guided by Bangladesh Ministry of Health criteria, requiring a valid passport, equivalence of O-Level/A-Level grades, and NEET qualifying marks for Indian candidates.
5. General Fees structures: Highly competitive, with flexible installment options for international students covering tuition, central library, laboratory fees, and premium air-conditioned hostel accommodations.`,
  opdSchedules: `Rangpur Community Medical College Hospital features dedicated departments operating at full performance:
- Outpatient Department (OPD): General Medicine, General Surgery, Gynecology & Obstetrics, Pediatrics, Ophthalmology, ENT, Orthopedics, Cardiology, and Dental Unit operate daily from 08:00 AM to 02:00 PM (except Fridays).
- Emergency Support: Fully functioning 24 hours a day, 7 days a week, 365 days a year with active on-call Specialist Medical Officers.
- Intensive Care: Fully equipped 20-bed ICU, CCU, and Neonatal-NICU running 24/7.`,
  commonFaqs: `Q: Is RCMC recognized globally?
A: Yes, RCMC is listed in the World Directory of Medical Schools (WDMS) and recognized by the NMC (National Medical Commission, India), NMC (Nepal Medical Council), and BMDC.

Q: What are the accommodation facilities?
A: RCMC offers separate multistory premium hostels for male and female students, with 24/7 security, high-speed Wi-Fi, air conditioning, and multiple dining options serving both local, Indian, and vegetarian cuisines.

Q: Where is RCMC located?
A: It is located in Medical East Sarak, Rangpur, Bangladesh. Phone support: +880-1711-XXXXXX, Email: info@rcmc.com.bd.`,
  aiWelcomeMessage: "Welcome to RCMC Medical Portal! 🏥 How can we assist you today? Please feel free to ask about MBBS/BDS Admissions, Hospital Services, CCU/ICU Bed Availability, or outpatient schedules.",
  customPromptOverlay: "Act as a compassionate, highly professional, and accurate medical college & hospital customer support desk officer. Focus strictly on academic admissions and medical services provided directly by Rangpur Community Medical College and Hospital (rcmc.com.bd). Avoid prescribing specific medications or diagnosing serious conditions; instead, guide visitors to book an appointment with our specialist OPD doctors if they share critical physical symptoms."
};

// Helper to instantiate Gemini AI on-demand (lazy-initialization)
let aiClient: any = null;
function getAiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY is not defined. AI responses will operate in fallback mock mode.");
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// System prompt builder
function buildSystemPrompt(department: string) {
  return `You are default customer support AI advisor for "${knowledgeConfig.hospitalName}".
Your focus department is: "${department}".

Information about RCMC:
${knowledgeConfig.aboutText}

Admission Details:
${knowledgeConfig.admissionInfo}

Outpatient Department (OPD) & Emergency Schedules:
${knowledgeConfig.opdSchedules}

FAQs & Contact Info:
${knowledgeConfig.commonFaqs}

Admin Directives:
${knowledgeConfig.customPromptOverlay}

Rules:
1. Speak in a highly polite, welcoming, professional, and reassuring tone.
2. Keep your answers concise, structured (using list items or bold text for key details).
3. If the user asks general question about admissions or fees, guide them beautifully and provide the contact channels (details: admissions@rcmc.com.bd, medical clinic portal).
4. If they ask about symptoms of heavy medical diseases, politely advise them to check with our OPD specialists, mentioning we operate a 750-bed modern hospital with 24/7 emergency care.
5. Keep your responses in clean Markdown format.`;
}

// APIs

// Get config
app.get("/api/config", (req, res) => {
  res.json(knowledgeConfig);
});

// Update config (Admin only)
app.post("/api/config", (req, res) => {
  knowledgeConfig = { ...knowledgeConfig, ...req.body };
  res.json({ success: true, config: knowledgeConfig });
});

// Clear chats
app.post("/api/sessions/clear-all", (req, res) => {
  chatSessions = {};
  res.json({ success: true, message: "Cleared all active support sessions!" });
});

// Get all active sessions
app.get("/api/sessions", (req, res) => {
  const sessionsList = Object.values(chatSessions).sort((a: any, b: any) => b.updatedAt - a.updatedAt);
  res.json(sessionsList);
});

// Get single session details
app.get("/api/sessions/:id", (req, res) => {
  const session = chatSessions[req.params.id];
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }
  res.json(session);
});

// Join/Start session
app.post("/api/sessions/start", (req, res) => {
  const { visitorName, visitorEmail, visitorPhone, department } = req.body;
  if (!visitorName || !visitorEmail) {
    return res.status(400).json({ error: "Name and Email are required to start support session." });
  }

  const id = `session-${Date.now()}-${nextSessionId++}`;
  const initialWelcome: any = {
    id: `msg-${Date.now()}-${nextMessageId++}`,
    sender: "ai",
    senderName: "RCMC Support Assistant",
    text: knowledgeConfig.aiWelcomeMessage,
    timestamp: Date.now()
  };

  const newSession = {
    id,
    visitorName,
    visitorEmail,
    visitorPhone: visitorPhone || "",
    department: department || "General Admissions",
    status: "active",
    takeover: false,
    messages: [initialWelcome],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  chatSessions[id] = newSession;
  res.json(newSession);
});

// Post message to session
app.post("/api/sessions/:id/messages", async (req, res) => {
  const sessionId = req.params.id;
  const session = chatSessions[sessionId];
  
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  const { sender, senderName, text } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Message text cannot be empty." });
  }

  // Append original message
  const userMsg = {
    id: `msg-${Date.now()}-${nextMessageId++}`,
    sender, // 'visitor' or 'agent'
    senderName,
    text,
    timestamp: Date.now()
  };

  session.messages.push(userMsg);
  session.updatedAt = Date.now();

  // If sent by visitor and takeover is false, run server-side Gemini support answers
  if (sender === "visitor" && !session.takeover) {
    try {
      const aiInstance = getAiClient();
      let aiResponseText = "";

      if (aiInstance) {
        // Compile history for context
        const recentMessages = session.messages.slice(-10); // get last 10 messages
        const promptHistory = recentMessages.map((m: any) => {
          return `${m.senderName} (${m.sender}): ${m.text}`;
        }).join("\n");

        const promptTemplate = `Conversation history:
${promptHistory}

Evaluate the visitor's statement: "${text}" and reply directly as the helper AI agent.`;

        const responseObj = await aiInstance.models.generateContent({
          model: "gemini-3.5-flash",
          contents: promptTemplate,
          config: {
            systemInstruction: buildSystemPrompt(session.department),
            temperature: 0.7,
          }
        });

        aiResponseText = responseObj.text || "I apologize, but I could not formulate a clear response. Please try contacting our support desk at admission@rcmc.com.bd.";
      } else {
        // Fallback simulation when key is missing or testing offline
        aiResponseText = `* RCMC Hospital Auto-Response (Demo Mode) * \n\nThank you for reaching out! We have received your query regarding **"${text}"**. \n\n**Rangpur Community Medical College**'s admissions department can be reached directly via **admission@rcmc.com.bd** or contact office: **+880-1711-XXXXXX**.\n\nOur regular medical Outpatient Department (OPD) is active Monday-Thursday 8:00 AM to 2:00 PM at Medical East Sarak, Rangpur.`;
      }

      const aiMsg = {
        id: `msg-${Date.now()}-${nextMessageId++}`,
        sender: "ai",
        senderName: "RCMC Support Assistant",
        text: aiResponseText,
        timestamp: Date.now()
      };

      session.messages.push(aiMsg);
      session.updatedAt = Date.now();
    } catch (err: any) {
      console.error("Error generating Gemini support response:", err);
      const systemErrorMsg = {
        id: `msg-${Date.now()}-${nextMessageId++}`,
        sender: "ai",
        senderName: "System Support",
        text: `Sorry! Our support assistant encountered a brief loading delay: ${err.message}. Please feel free to write again or toggle 'Request Live Agent' directly.`,
        timestamp: Date.now()
      };
      session.messages.push(systemErrorMsg);
    }
  }

  res.json(session);
});

// Takeover Toggle (Agent Live Intervention)
app.post("/api/sessions/:id/takeover", (req, res) => {
  const sessionId = req.params.id;
  const session = chatSessions[sessionId];
  
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  const { takeover } = req.body;
  session.takeover = !!takeover;
  session.updatedAt = Date.now();

  const statusMsg = {
    id: `msg-${Date.now()}-${nextMessageId++}`,
    sender: "system",
    senderName: "System Alert",
    text: takeover 
      ? "🚨 A Rangpur Community Medical College human support agent has taken control. Automated responses are temporarily paused."
      : "ℹ️ Support agent has put chat back into Auto-Support pilot mode.",
    timestamp: Date.now()
  };

  session.messages.push(statusMsg);
  res.json(session);
});

// Resolve Support Session
app.post("/api/sessions/:id/resolve", (req, res) => {
  const sessionId = req.params.id;
  const session = chatSessions[sessionId];
  
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  session.status = "resolved";
  session.updatedAt = Date.now();

  const resolveMsg = {
    id: `msg-${Date.now()}-${nextMessageId++}`,
    sender: "system",
    senderName: "System Alert",
    text: "✅ This support session has been set to Resolved. Thank you for visiting RCMC!",
    timestamp: Date.now()
  };

  session.messages.push(resolveMsg);
  res.json(session);
});

// Helper for dynamic generation of WordPress Plugin php file code
app.get("/api/wordpress-preset", (req, res) => {
  const appUrl = process.env.APP_URL || "https://example.com";
  
  const phpCode = `<?xml version="1.0" encoding="utf-8"?>
<?php
/**
 * Plugin Name: RCMC Medical Support AI Chat Widget
 * Plugin URI:  ${appUrl}
 * Description: Embeds an interactive, department-aware AI medical advisor and live-agent takeover chatbot widget on WordPress pages.
 * Version:     1.1.0
 * Author:      RCMC CSE Team
 * Author URI:  https://rcmc.com.bd
 * License:     Apache 2.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly.
}

class RCMC_AI_Chat_Widget {

    public function __construct() {
        add_action( 'wp_footer', array( $this, 'rcmc_inject_chat_script' ) );
        add_action( 'admin_menu', array( $this, 'rcmc_plugin_setup_menu' ) );
    }

    /**
     * Injects the floating interactive HTML iframe widget to the bottom of WordPress frontend pages.
     */
    public function rcmc_inject_chat_script() {
        ?>
        <!-- RCMC AI Support Chat Embed Module -->
        <div id="rcmc-ai-support-container" style="position: fixed; bottom: 20px; right: 20px; z-index: 999999; display: block; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.15);">
            <iframe 
                src="${appUrl}?embed=true" 
                style="border: none; width: 400px; height: 600px; max-height: 85vh; max-width: 90vw;" 
                id="rcmc-ai-chat-frame"
                allow="camera; microphone; geolocation"
            ></iframe>
        </div>
        <?php
    }

    /**
     * Adds the RCMC AI Plugin management icon to the WordPress side-panel
     */
    public function rcmc_plugin_setup_menu() {
        add_menu_page(
            'RCMC AI Support',
            'RCMC AI Chat',
            'manage_options',
            'rcmc-ai-support-slug',
            array( $this, 'rcmc_admin_page_render' ),
            'dashicons-format-chat',
            90
        );
    }

    public function rcmc_admin_page_render() {
        ?>
        <div class="wrap">
            <h1>RCMC AI Support Manager</h1>
            <p>Your AI assistant dashboard is hosted externally at <strong>${appUrl}</strong>.</p>
            <hr />
            <table class="form-table">
                <tr valign="top">
                    <th scope="row">AI Integration Status</th>
                    <td><span style="background: #4ade80; color: #042f1a; padding: 4px 10px; border-radius: 4px; font-weight: bold;">CONNECTED</span></td>
                </tr>
                <tr valign="top">
                    <th scope="row">Live Iframe Gateway</th>
                    <td><code>${appUrl}?embed=true</code></td>
                </tr>
            </table>
            <br />
            <a href="${appUrl}" target="_blank" class="button button-primary">Open RCMC Agent Control Panel</a>
        </div>
        <?php
    }
}

new RCMC_AI_Chat_Widget();
`;

  res.type('text/plain').send(phpCode);
});


// Server setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
