import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { 
  Sliders, MessageSquare, Code, Settings, Users, Database, Sparkles, Send, 
  Check, Copy, RefreshCw, Trash2, ShieldAlert, CheckCircle, Info, FileCode, AlertCircle, Play, CornerDownLeft, Network, Phone, HelpCircle, X
} from 'lucide-react';
import ChatWidget from './components/ChatWidget';
import { ChatSession, KnowledgeConfig, Message } from './types';

export default function App() {
  const [config, setConfig] = useState<KnowledgeConfig | null>(null);
  
  // Storage logic
  const [allSessions, setAllSessions] = useState<ChatSession[]>([]);
  const [visitorSession, setVisitorSession] = useState<ChatSession | null>(null);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);

  // Loading and Error states
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPhp, setCopiedPhp] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [isSimulatedWidgetOpen, setIsSimulatedWidgetOpen] = useState(true);

  // Form parameters
  const [hospitalName, setHospitalName] = useState('');
  const [aboutText, setAboutText] = useState('');
  const [admissionInfo, setAdmissionInfo] = useState('');
  const [opdSchedules, setOpdSchedules] = useState('');
  const [commonFaqs, setCommonFaqs] = useState('');
  const [aiWelcomeMessage, setAiWelcomeMessage] = useState('');
  const [customPromptOverlay, setCustomPromptOverlay] = useState('');

  // Right-Panel state tabs
  const [rightPanelTab, setRightPanelTab] = useState<'operator' | 'wp-code'>('operator');

  // Mobile active layout tab (only active on responsive viewports <xl)
  const [activeMobileTab, setActiveMobileTab] = useState<'config' | 'preview' | 'operator'>('preview');

  // Input for live operator desk
  const [operatorInput, setOperatorInput] = useState('');

  // Helper to safely parse JSON response avoiding <!doctype html template issues during background restarts
  const safeJson = async (res: Response) => {
    try {
      const contentType = res.headers.get('content-type');
      if (!res.ok || !contentType || !contentType.includes('application/json')) {
        return null;
      }
      return await res.json();
    } catch {
      return null;
    }
  };

  // Fetch from Node API
  const syncState = async () => {
    try {
      const configRes = await fetch('/api/config');
      const configData = await safeJson(configRes);
      if (!configData) {
        throw new Error('Backend configurations not ready.');
      }
      setConfig(configData);

      // Initialize form variables
      if (!hospitalName) {
        setHospitalName(configData.hospitalName);
        setAboutText(configData.aboutText);
        setAdmissionInfo(configData.admissionInfo);
        setOpdSchedules(configData.opdSchedules);
        setCommonFaqs(configData.commonFaqs);
        setAiWelcomeMessage(configData.aiWelcomeMessage);
        setCustomPromptOverlay(configData.customPromptOverlay);
      }

      const sessionsRes = await fetch('/api/sessions');
      const sessionsData = await safeJson(sessionsRes);
      if (sessionsData) {
        setAllSessions(sessionsData);

        // Keep selected and active sessions updated
        if (selectedSession) {
          const matched = sessionsData.find((s: ChatSession) => s.id === selectedSession.id);
          if (matched) setSelectedSession(matched);
        }

        // Retrieve cached visitor session or auto-initialize one
        const savedSessionId = localStorage.getItem('rcmc_visitor_session_id');
        let currentVisSession = visitorSession;
        if (savedSessionId && !currentVisSession) {
          const matched2 = sessionsData.find((s: ChatSession) => s.id === savedSessionId);
          if (matched2) {
            currentVisSession = matched2;
            setVisitorSession(matched2);
          }
        } else if (currentVisSession) {
          const matched2 = sessionsData.find((s: ChatSession) => s.id === currentVisSession.id);
          if (matched2) {
            currentVisSession = matched2;
            setVisitorSession(matched2);
          } else {
            // It has been cleared on the backend server
            currentVisSession = null;
            setVisitorSession(null);
            localStorage.removeItem('rcmc_visitor_session_id');
          }
        }

        // If no active session, automatically start a session anonymously
        if (!currentVisSession) {
          const guestNum = Math.floor(Math.random() * 9000) + 1000;
          const guestName = `Guest Student #${guestNum}`;
          const guestEmail = `guest_${Date.now()}_${guestNum}@rcmc-portal.bd`;
          
          try {
            const startRes = await fetch('/api/sessions/start', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                visitorName: guestName,
                visitorEmail: guestEmail,
                visitorPhone: '',
                department: 'General Support'
              })
            });
            const data = await safeJson(startRes);
            if (data) {
              setVisitorSession(data);
              localStorage.setItem('rcmc_visitor_session_id', data.id);
              
              // Refresh full session listings
              const refreshRes = await fetch('/api/sessions');
              const refreshData = await safeJson(refreshRes);
              if (refreshData) {
                setAllSessions(refreshData);
              }
            }
          } catch (err) {
            console.error('Failed to auto-start session: ', err);
          }
        }
      }
      setLoading(false);
    } catch (err: any) {
      console.warn('Sync warning:', err.message);
      // Fail gracefully without fully freezing the UI loaders during background build pauses
      if (config) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    syncState();
    const interval = setInterval(syncState, 3500);
    return () => clearInterval(interval);
  }, [selectedSession?.id, visitorSession?.id]);

  // Handle saving new configuration parameters
  const saveKnowledgeBase = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updatedConfig = {
        hospitalName,
        aboutText,
        admissionInfo,
        opdSchedules,
        commonFaqs,
        aiWelcomeMessage,
        customPromptOverlay
      };
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedConfig)
      });
      const data = await safeJson(res);
      if (data && data.config) {
        setConfig(data.config);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle starting floating widget chat session
  const handleStartSession = async (visitor: { name: string; email: string; phone: string; department: string }) => {
    try {
      const res = await fetch('/api/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorName: visitor.name,
          visitorEmail: visitor.email,
          visitorPhone: visitor.phone,
          department: visitor.department
        })
      });
      const data = await safeJson(res);
      if (data) {
        setVisitorSession(data);
        syncState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Send interactive chat messages
  const handleSendMessage = async (text: string, isFromVisitor: boolean = true) => {
    const targetSession = isFromVisitor ? visitorSession : selectedSession;
    if (!targetSession) return;

    try {
      const res = await fetch(`/api/sessions/${targetSession.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: isFromVisitor ? 'visitor' : 'agent',
          senderName: isFromVisitor ? targetSession.visitorName : 'RCMC Support Officer',
          text
        })
      });
      const data = await safeJson(res);
      if (data) {
        if (isFromVisitor) {
          setVisitorSession(data);
        } else {
          setSelectedSession(data);
        }
        syncState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Manage Live Takeover switches
  const handleTakeoverToggle = async (sessionId: string, status: boolean) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/takeover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ takeover: status })
      });
      const data = await safeJson(res);
      if (data) {
        if (visitorSession && visitorSession.id === sessionId) setVisitorSession(data);
        if (selectedSession && selectedSession.id === sessionId) setSelectedSession(data);
        syncState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Close active tickets
  const handleResolveSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/resolve`, {
        method: 'POST'
      });
      const data = await safeJson(res);
      if (data) {
        if (visitorSession && visitorSession.id === sessionId) setVisitorSession(data);
        if (selectedSession && selectedSession.id === sessionId) setSelectedSession(data);
        syncState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Clear Chats & dialogues
  const handleClearSessions = async () => {
    try {
      await fetch('/api/sessions/clear-all', { method: 'POST' });
      localStorage.removeItem('rcmc_visitor_session_id');
      setVisitorSession(null);
      setSelectedSession(null);
      setAllSessions([]);
      syncState();
    } catch (err) {
      console.error(err);
    }
  };

  const handleOperatorSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorInput.trim() || !selectedSession) return;
    handleSendMessage(operatorInput, false);
    setOperatorInput('');
  };

  const copyText = (code: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="bg-neutral-900 text-neutral-100 min-h-screen flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs uppercase tracking-widest font-mono text-emerald-400">Loading Medical AI Plugin Workspace...</p>
      </div>
    );
  }

  // Active server coordinates for embed tags
  const serverOriginUrl = window.location.origin;

  const htmlIframeCode = `<!-- START RCMC FLOATING SUPPORT FRAME -->
<div id="rcmc-ai-support-container" style="position: fixed; bottom: 20px; right: 20px; z-index: 999999; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.15);">
    <iframe 
        src="${serverOriginUrl}?embed=true" 
        style="border: none; width: 400px; height: 600px; max-height: 85vh; max-width: 90vw;" 
        id="rcmc-ai-chat-frame"
        allow="camera; microphone; geolocation"
    ></iframe>
</div>
<!-- END RCMC FLOATING SUPPORT FRAME -->`;

  const phpFileCode = `<?php
/**
 * Plugin Name: RCMC Medical Support AI Chat Widget
 * Plugin URI:  https://rcmc.com.bd
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
    }

    public function rcmc_inject_chat_script() {
        ?>
        <div id="rcmc-ai-support-container" style="position: fixed; bottom: 20px; right: 20px; z-index: 999999; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.15);">
            <iframe 
                src="${serverOriginUrl}?embed=true" 
                style="border: none; width: 380px; height: 600px; max-height: 85vh; max-width: 95vw;" 
                id="rcmc-ai-chat-frame"
                allow="camera; microphone; geolocation"
            ></iframe>
        </div>
        <?php
    }
}

new RCMC_AI_Chat_Widget();`;

  const handleDownloadZip = async () => {
    setDownloadingZip(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("rcmc-ai-support");
      if (folder) {
        folder.file("rcmc-ai-support.php", phpFileCode);
      } else {
        zip.file("rcmc-ai-support.php", phpFileCode);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "rcmc-ai-support.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to compile ZIP or download plugin file: ", err);
    } finally {
      setDownloadingZip(false);
    }
  };

  return (
    <div className="bg-neutral-900 min-h-screen text-neutral-100 flex flex-col font-sans selection:bg-emerald-700 selection:text-white">
      
      {/* Top Application Header */}
      <header className="bg-neutral-950 border-b border-neutral-800 px-4 md:px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 text-white p-2 rounded-lg font-black text-lg shadow-sm shrink-0">
            WP
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-tight uppercase text-neutral-100 flex items-center flex-wrap gap-2">
              RCMC WordPress Support Chat Plugin
              <span className="bg-emerald-500/10 text-emerald-400 text-[9.5px] px-2 py-0.5 rounded-full border border-emerald-500/20 lowercase tracking-normal">v1.1.0-live</span>
            </h1>
            <p className="text-neutral-400 text-[11px] mt-0.5 hidden sm:block">
              Interactive setup, customized medical parameters, live Gemini advisor testing, other real-time support takeover keys.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-mono w-full sm:w-auto justify-between sm:justify-end">
          <span className="flex items-center gap-1.5 text-neutral-400 text-[11.5px] sm:text-xs">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            ACTIVE: {allSessions.length} sessions
          </span>
          <div className="flex items-center gap-2">
            <button 
              onClick={syncState}
              className="px-3 py-2 bg-neutral-850 hover:bg-neutral-800 rounded-lg text-neutral-300 border border-neutral-750 transition-colors cursor-pointer flex items-center gap-1 text-[11px] min-h-[40px]"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Sync
            </button>
            <button 
              onClick={handleClearSessions}
              className="px-3 py-2 bg-red-950/40 hover:bg-red-900/50 rounded-lg text-red-300 border border-red-900/30 transition-all cursor-pointer text-[11px] min-h-[40px]"
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Tabs Indicator */}
      <div className="xl:hidden bg-neutral-950 border-b border-neutral-800 flex justify-around p-1 shrink-0">
        <button
          onClick={() => setActiveMobileTab('config')}
          className={`flex-1 py-3 px-1 text-center text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1.5 ${activeMobileTab === 'config' ? 'border-emerald-500 text-emerald-400 bg-neutral-900/40' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}
        >
          <Database className="w-4 h-4 text-emerald-500" />
          <span className="text-[10px] sm:text-xs">Settings</span>
        </button>

        <button
          onClick={() => setActiveMobileTab('preview')}
          className={`flex-1 py-3 px-1 text-center text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1.5 ${activeMobileTab === 'preview' ? 'border-emerald-500 text-emerald-400 bg-neutral-900/40' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}
        >
          <Sparkles className="w-4 h-4 text-emerald-500 animate-pulse" />
          <span className="text-[10px] sm:text-xs">Preview URL</span>
        </button>

        <button
          onClick={() => setActiveMobileTab('operator')}
          className={`flex-1 py-3 px-1 text-center text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1.5 relative ${activeMobileTab === 'operator' ? 'border-emerald-500 text-emerald-400 bg-neutral-900/40' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}
        >
          <Users className="w-4 h-4 text-emerald-500" />
          <span className="text-[10px] sm:text-xs">Live Operator</span>
          {allSessions.length > 0 && (
            <span className="absolute top-1.5 right-1.5 sm:top-2.5 sm:right-2.5 bg-rose-600 text-white font-mono text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-4 flex items-center justify-center shadow-xs">
              {allSessions.length}
            </span>
          )}
        </button>
      </div>

      {/* Primary Split Workspace */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 overflow-y-auto xl:overflow-hidden min-h-0 divide-y xl:divide-y-0 xl:divide-x divide-neutral-800">
        
        {/* COLUMN 1: KNOWLEDGEBASE & PROMPT CONFIG (XL: 4-cols) */}
        <div className={`xl:col-span-4 bg-neutral-950 p-4 md:p-6 overflow-y-auto flex-col space-y-4 ${activeMobileTab === 'config' ? 'flex' : 'hidden xl:flex'}`}>
          <div className="border-b border-neutral-800 pb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-500" /> AI Prompts &amp; Knowledge Base
            </h2>
            <span className="text-[10px] text-neutral-500 font-mono">Syncs to Gemini</span>
          </div>

          {saveSuccess && (
            <div className="bg-emerald-950/50 border border-emerald-800 text-emerald-300 p-2.5 rounded-lg text-xs font-semibold">
              ✓ Saved knowledge parameters! Real-time previews will use this data.
            </div>
          )}

          <form onSubmit={saveKnowledgeBase} className="space-y-4 flex-1">
            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Official Institution Title</label>
              <input 
                type="text" 
                value={hospitalName} 
                onChange={(e) => setHospitalName(e.target.value)} 
                className="w-full bg-neutral-900 text-xs border border-neutral-700/60 rounded-lg p-2.5 focus:ring-1 focus:ring-emerald-500 text-neutral-100"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Default Message Welcome Greetings</label>
              <input 
                type="text" 
                value={aiWelcomeMessage} 
                onChange={(e) => setAiWelcomeMessage(e.target.value)} 
                className="w-full bg-neutral-900 text-xs border border-neutral-700/60 rounded-lg p-2.5 focus:ring-1 focus:ring-emerald-500 text-neutral-100"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">About RCMC Hub &amp; Location details</label>
              <textarea 
                rows={4}
                value={aboutText} 
                onChange={(e) => setAboutText(e.target.value)} 
                className="w-full bg-neutral-900 text-xs border border-neutral-700/60 rounded-lg p-2.5 focus:ring-1 focus:ring-emerald-500 text-neutral-105 font-mono text-[11px] leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Admissions Eligibility &amp; International application criteria</label>
              <textarea 
                rows={5}
                value={admissionInfo} 
                onChange={(e) => setAdmissionInfo(e.target.value)} 
                className="w-full bg-neutral-900 text-xs border border-neutral-700/60 rounded-lg p-2.5 focus:ring-1 focus:ring-emerald-500 text-neutral-105 font-mono text-[11px] leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Outpatient OPD, CCU Bed, &amp; 24h Trauma Availability</label>
              <textarea 
                rows={4}
                value={opdSchedules} 
                onChange={(e) => setOpdSchedules(e.target.value)} 
                className="w-full bg-neutral-900 text-xs border border-neutral-700/60 rounded-lg p-2.5 focus:ring-1 focus:ring-emerald-500 text-neutral-105 font-mono text-[11px] leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">FAQ Info &amp; Hostels Accommodation</label>
              <textarea 
                rows={4}
                value={commonFaqs} 
                onChange={(e) => setCommonFaqs(e.target.value)} 
                className="w-full bg-neutral-900 text-xs border border-neutral-700/60 rounded-lg p-2.5 focus:ring-1 focus:ring-emerald-500 text-neutral-105 font-mono text-[11px] leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Specific AI Behavioral Instructions (System Prompt Modifier)</label>
              <textarea 
                rows={3}
                value={customPromptOverlay} 
                onChange={(e) => setCustomPromptOverlay(e.target.value)} 
                className="w-full bg-neutral-900 border border-emerald-900/50 rounded-lg p-2.5 focus:ring-1 focus:ring-emerald-500 text-emerald-350 font-mono text-[11px] leading-relaxed"
              />
            </div>

            <div className="pt-2">
              <button 
                type="submit"
                className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-3 text-xs rounded-lg shadow-md transition-all cursor-pointer border border-emerald-800"
              >
                Apply Live Prompt Settings
              </button>
            </div>
          </form>
        </div>

        {/* COLUMN 2: LIVE SIMULATION WIDGET DISPLAY (XL: 4-cols) */}
        <div className={`xl:col-span-4 bg-neutral-900 p-4 md:p-6 overflow-y-auto flex-col justify-between items-center text-center space-y-4 ${activeMobileTab === 'preview' ? 'flex' : 'hidden xl:flex'}`}>
          <div className="w-full border-b border-neutral-800 pb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500" /> Live Website Preview Window
            </h2>
            <span className="text-[10px] bg-neutral-805 text-emerald-400 px-2.5 py-0.5 rounded-md font-mono border border-emerald-950">WordPress Plugin Active</span>
          </div>

          {/* WordPress Page Canvas Wrapper */}
          <div className="w-full flex-1 flex flex-col items-center justify-center py-4">
            
            {/* Simulation Header */}
            <div className="w-full max-w-[390px] mb-2 px-3 flex justify-between items-center text-left text-[10px] text-neutral-500 font-mono">
              <span className="flex items-center gap-1">🌐 http://rcmc.com.bd</span>
              <span className="text-emerald-500 font-bold">100% Embedded Plugin</span>
            </div>

            {/* Custom high fidelity simulated webpage background */}
            <div className="w-full max-w-[400px] h-[550px] bg-neutral-950 border border-neutral-800 p-2.5 rounded-2xl flex flex-col shadow-2xl relative overflow-hidden">
              
              {/* Inner Web Page Frame */}
              <div className="w-full h-full bg-neutral-100 rounded-xl overflow-hidden relative border border-neutral-300 flex flex-col select-none text-left">
                
                {/* Mock Website Navbar */}
                <div className="bg-emerald-800 text-white p-2.5 shrink-0 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-sm tracking-tighter text-emerald-100 flex items-center gap-1">
                      <span className="bg-white text-emerald-800 w-4.5 h-4.5 rounded-full flex items-center justify-center font-bold text-[10px] leading-none shrink-0 mb-0.5 shadow-xs">✙</span>
                      RCMC
                    </span>
                  </div>
                  <div className="flex gap-2 text-[9px] font-bold text-emerald-250">
                    <span className="hover:text-white cursor-pointer transition-colors underline underline-offset-2">Admissions</span>
                    <span>•</span>
                    <span className="hover:text-white cursor-pointer transition-colors">Courses</span>
                    <span>•</span>
                    <span className="hover:text-white cursor-pointer transition-colors">OPD Roster</span>
                  </div>
                </div>

                {/* Homepage Hero Content Details */}
                <div className="flex-1 p-3.5 space-y-3.5 overflow-y-auto">
                  
                  {/* Floating Notification Banner */}
                  <div className="bg-white border border-emerald-200/60 rounded-lg p-2.5 shadow-2xs space-y-1">
                    <span className="inline-block bg-emerald-50 text-emerald-800 text-[8px] font-extrabold tracking-widest uppercase px-1.5 py-0.5 rounded border border-emerald-200">
                      Admissions Notice 2026-2027
                    </span>
                    <h3 className="font-bold text-xs text-neutral-800 leading-tight">Apply for BDS or MBBS Program Degrees</h3>
                    <p className="text-[10px] text-neutral-500 leading-relaxed">
                      Rangpur Community Medical College welcomes global applicants to pursue prestigious medical programs. Fully-equipped AC hostels, multi-cuisine clinics, and immediate internship streams available.
                    </p>
                  </div>

                  {/* Medical Services Grid */}
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-white p-2 rounded border border-neutral-200">
                      <span className="font-extrabold text-[9px] text-emerald-800 block mb-1">⚕ MBBS DEGREE</span>
                      <p className="text-[9px] text-neutral-400 leading-normal">
                        5 year academic structure with practical rotations at 750-bed inpatient hospital.
                      </p>
                    </div>
                    <div className="bg-white p-2 rounded border border-neutral-200">
                      <span className="font-extrabold text-[9px] text-teal-800 block mb-1">🦷 DENTAL BDS</span>
                      <p className="text-[9px] text-neutral-400 leading-normal">
                        Modern dentistry equipment labs. Accredited international faculties and boards.
                      </p>
                    </div>
                  </div>

                  {/* FAQ trigger helper instruction */}
                  <div className="bg-neutral-50 rounded-lg p-2.5 border border-dashed border-neutral-300">
                    <h4 className="text-[10px] font-bold text-neutral-600">Need immediate help?</h4>
                    <p className="text-[9.5px] text-neutral-500 mt-1 leading-normal">
                      Use the interactive **medical support chat icon** in the **bottom right corner** to ask admission questions or register with our support team! Let our customized Support Assistant assist you.
                    </p>
                  </div>
                  
                  <div className="text-[10px] text-neutral-400 text-center pt-2">
                    Hospital Head Office, Rangpur, Bangladesh • Phone: +880-1700-000000
                  </div>

                </div>

                {/* THE COLLAPSED CHAT WIDGET POPUP BAR (FLOATS OVER PREVIEW CANVAS) */}
                {isSimulatedWidgetOpen && (
                  <div className="absolute bottom-16 right-3 left-3 top-3 z-30 flex flex-col shadow-2xl transition-all duration-300 ease-out origin-bottom-right">
                    {config && (
                      <ChatWidget 
                        config={config}
                        session={visitorSession}
                        onStartSession={handleStartSession}
                        onSendMessage={(text) => handleSendMessage(text, true)}
                        onTakeoverToggle={(val) => visitorSession && handleTakeoverToggle(visitorSession.id, val)}
                        onClose={() => setIsSimulatedWidgetOpen(false)}
                      />
                    )}
                  </div>
                )}

                {/* ICON LAUNCHER / FLOATING MESSAGE ICON SITUATED AT THE WEBSITE BOTTOM-RIGHT CORNER */}
                <div className="absolute bottom-3 right-3 z-40 flex items-center gap-2">
                  
                  {/* Interactive Badge Notification Pill */}
                  {!isSimulatedWidgetOpen && (
                    <div className="bg-neutral-900 border border-neutral-800 text-white text-[9px] font-extrabold px-2.5 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 animate-pulse max-w-44 select-none mr-1.5 whitespace-nowrap">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                      <span>Ask Admissions Support</span>
                    </div>
                  )}

                  {/* Rounded Trigger Bubble Icon */}
                  <button
                    type="button"
                    onClick={() => setIsSimulatedWidgetOpen(!isSimulatedWidgetOpen)}
                    className="w-11 h-11 rounded-full bg-gradient-to-r from-emerald-700 to-teal-900 text-white flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all text-sm cursor-pointer border border-emerald-600"
                    title={isSimulatedWidgetOpen ? "Collapse Chat Window" : "Open Chat Window"}
                  >
                    {isSimulatedWidgetOpen ? (
                      <X className="w-5 h-5 animate-spin-once" />
                    ) : (
                      <MessageSquare className="w-5 h-5 animate-pulse" />
                    )}
                  </button>

                </div>

              </div>

            </div>

            {/* Hint alert */}
            <div className="w-full max-w-[380px] p-2.5 bg-neutral-950 border border-neutral-850 text-[10px] rounded-lg mt-3 text-neutral-400 leading-relaxed">
              <strong>💡 Live Website Simulation:</strong> Click the chat/message icon inside the webpage mockup in the bottom right corner above to toggle the admissions console open or closed!
            </div>
          </div>
        </div>

        {/* COLUMN 3: OPERATOR RESPONSE DESK & CODE GENERATOR (XL: 4-cols) */}
        <div className={`xl:col-span-4 bg-neutral-950 flex-col overflow-hidden ${activeMobileTab === 'operator' ? 'flex' : 'hidden xl:flex'}`}>
          
          {/* Navigation Sub-Tabs */}
          <div className="bg-neutral-950 border-b border-neutral-800 flex justify-between shrink-0">
            <button
              onClick={() => setRightPanelTab('operator')}
              className={`flex-1 py-3 px-2 text-center text-[11px] font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${rightPanelTab === 'operator' ? 'border-emerald-500 text-emerald-400 bg-neutral-900/40' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}
            >
              <Users className="w-3.5 h-3.5" /> Support Operator Desk
            </button>
            <button
              onClick={() => setRightPanelTab('wp-code')}
              className={`flex-1 py-3 px-2 text-center text-[11px] font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${rightPanelTab === 'wp-code' ? 'border-emerald-500 text-emerald-400 bg-neutral-900/40' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}
            >
              <FileCode className="w-3.5 h-3.5" /> WP Plugin PHP Source
            </button>
          </div>

          {/* Tab content area */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col min-h-0">
            
            {/* VIEW A: LIVE PORTAL OPERATOR DESK */}
            {rightPanelTab === 'operator' && (
              <div className="flex-1 flex flex-col divide-y divide-neutral-850 min-h-0">
                
                {/* Active Session logs menu */}
                <div className="pb-4 shrink-0">
                  <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">Live Consultations Inbox ({allSessions.length})</h3>
                  {allSessions.length === 0 ? (
                    <div className="bg-neutral-900/40 border border-neutral-850 p-4 text-center rounded-xl text-neutral-500 text-[11px] leading-relaxed">
                      No customer sessions is online. Complete the info card on the preview widget in the middle column to initiate a test support conversation!
                    </div>
                  ) : (
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hidden">
                      {allSessions.map((s) => {
                        const isSel = selectedSession?.id === s.id;
                        const isClosed = s.status === 'resolved';

                        return (
                          <button
                            key={s.id}
                            onClick={() => setSelectedSession(s)}
                            className={`p-3 text-left rounded-lg transition-all shrink-0 min-w-36 flex flex-col space-y-1.5 border cursor-pointer ${isSel ? 'bg-emerald-950/45 border-emerald-600' : 'bg-neutral-900 border-neutral-800'}`}
                          >
                            <span className="font-bold text-xs truncate max-w-32 block text-neutral-100">{s.visitorName}</span>
                            <span className="text-[9px] text-neutral-400 font-mono truncate max-w-32 block">{s.department}</span>
                            
                            <div className="flex justify-between items-center pt-1 border-t border-neutral-805 text-[8px]">
                              {isClosed ? (
                                <span className="text-neutral-500">CLOSED</span>
                              ) : s.takeover ? (
                                <span className="text-rose-400 animate-pulse font-bold">TAKEOVER</span>
                              ) : (
                                <span className="text-emerald-400 font-bold">AI ACTIVE</span>
                              )}
                              <span className="text-neutral-500">{new Date(s.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Selected active chat transcript panel */}
                <div className="flex-1 pt-4 flex flex-col min-h-[300px]">
                  {selectedSession ? (
                    <div className="flex-1 flex flex-col justify-between">
                      
                      {/* Active conversation details */}
                      <div className="bg-neutral-900/80 p-3 rounded-lg border border-neutral-850 space-y-1 text-xs mb-3">
                        <div className="flex justify-between">
                          <span className="font-bold text-neutral-200">Patient: {selectedSession.visitorName}</span>
                          <span className="bg-emerald-950 text-emerald-300 font-mono text-[9px] px-2 py-0.5 rounded-sm">
                            {selectedSession.visitorEmail}
                          </span>
                        </div>
                        {selectedSession.visitorPhone && (
                          <div className="text-[10px] text-neutral-400">Phone: {selectedSession.visitorPhone}</div>
                        )}
                        
                        <div className="flex justify-between items-center pt-2 border-t border-neutral-800 mt-1">
                          {selectedSession.status === 'active' ? (
                            <button
                              onClick={() => handleTakeoverToggle(selectedSession.id, !selectedSession.takeover)}
                              className={`text-[9.5px] font-bold px-2.5 py-1 rounded-md border transition-all cursor-pointer ${selectedSession.takeover ? 'bg-emerald-900 border-emerald-600 text-emerald-350 shadow-2xs' : 'bg-rose-950/60 border-rose-900 text-rose-300 hover:text-white shadow-2xs'}`}
                            >
                              {selectedSession.takeover ? '✓ Co-Pilot Mode Active' : '🚨 Turn On Operator Takeover'}
                            </button>
                          ) : (
                            <span className="text-[9.5px] text-neutral-500">🔒 CONTEXT CLOSED</span>
                          )}

                          {selectedSession.status === 'active' && (
                            <button
                              onClick={() => handleResolveSession(selectedSession.id)}
                              className="text-[9.5px] bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border border-neutral-700 px-2 py-1 rounded-md transition-colors cursor-pointer"
                            >
                              ✓ Finalize Resolved
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Conversation Log feed */}
                      <div className="flex-1 overflow-y-auto space-y-3 bg-neutral-900/30 border border-neutral-850/50 p-3 rounded-xl max-h-[25vh] md:max-h-[35vh] lg:max-h-[18rem]">
                        {selectedSession.messages.map((m) => {
                          const isAgent = m.sender === 'agent';
                          const isSystem = m.sender === 'system';
                          const isAi = m.sender === 'ai';

                          if (isSystem) {
                            return (
                              <div key={m.id} className="text-center my-2 text-[9px] text-neutral-500 font-mono uppercase bg-neutral-950 p-1 rounded-md border border-neutral-850">
                                {m.text}
                              </div>
                            );
                          }

                          return (
                            <div key={m.id} className={`flex gap-2 ${isAgent ? 'justify-end' : 'justify-start'}`}>
                              <div className="max-w-[85%]">
                                <div className="text-[8px] text-neutral-400 mb-0.5">
                                  <span className="font-bold text-neutral-300">{m.senderName}</span> • {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <div className={`p-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${isAgent ? 'bg-emerald-850 text-white rounded-tr-none' : 'bg-neutral-900 text-neutral-250 border border-neutral-800 rounded-tl-none'}`}>
                                  {m.text}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Operator replies form */}
                      {selectedSession.status === 'active' ? (
                        <div className="pt-3 border-t border-neutral-850 mt-3 bg-neutral-950 rounded-b-xl">
                          {!selectedSession.takeover && (
                            <div className="mb-2 bg-rose-955/20 border border-rose-900/30 text-rose-350 p-2 rounded-lg text-[9px] flex gap-1.5 items-center">
                              <AlertCircle className="w-4.5 h-4.5 text-rose-400 shrink-0" />
                              <span>AI-pilot simulation is enabled. Turn on <strong>Operator Takeover</strong> above to mute AI and message manually.</span>
                            </div>
                          )}

                          <form onSubmit={handleOperatorSend} className="flex gap-2">
                            <input
                              type="text"
                              value={operatorInput}
                              onChange={(e) => setOperatorInput(e.target.value)}
                              placeholder={selectedSession.takeover ? "Type support response..." : "Enable human takeover key above to message..."}
                              className="flex-1 bg-neutral-900 text-xs border border-neutral-750 text-white rounded-lg p-3.5 focus:outline-hidden"
                            />
                            <button
                              type="submit"
                              className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-4 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer border border-emerald-800"
                            >
                              Reply <CornerDownLeft className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        </div>
                      ) : (
                        <div className="bg-neutral-900 border border-neutral-850 p-4 text-center rounded-lg text-neutral-500 text-xs mt-3">
                          🔒 This counseling has been finalized and labeled resolved.
                        </div>
                      )}

                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-neutral-500 my-auto">
                      <HelpCircle className="w-10 h-10 text-neutral-700 mb-2" />
                      <p className="text-xs font-bold">Select Active Conversation</p>
                      <p className="text-[11px] text-neutral-500 mt-1 max-w-xs leading-relaxed">
                        Incoming messages, active consultations, and help tickets trigger here so that hospital administrators can engage with patients manually.
                      </p>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* VIEW B: WORDPRESS PHP COMPONENT AND HTML TAGS */}
            {rightPanelTab === 'wp-code' && (
              <div className="flex-1 flex flex-col space-y-4">
                
                <div className="bg-emerald-950/20 border border-emerald-900/30 text-emerald-300 p-3 rounded-lg text-xs leading-relaxed">
                  <strong>💡 WordPress Integration Manual:</strong> This plugin operates fully and hooks directly to your current container origin <code>{serverOriginUrl}</code>. Paste the codes below on your site to establish real-time AI capabilities instantly.
                </div>

                {/* Embedded HTML Framework */}
                <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 space-y-2">
                  <div className="flex justify-between items-center border-b border-neutral-800 pb-2">
                    <span className="text-[10px] font-bold text-emerald-400 font-mono">OPTION A: GLOBAL WEB EMBED (HTML)</span>
                    <button
                      onClick={() => copyText(htmlIframeCode, setCopiedCode)}
                      className="p-1 px-2 hover:bg-neutral-800 text-[9.5px] font-bold rounded-md bg-neutral-850 border border-neutral-750 text-neutral-350 cursor-pointer flex items-center gap-1.5"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedCode ? 'COPIED!' : 'COPY CODE'}
                    </button>
                  </div>
                  <pre className="bg-neutral-950 p-2.5 rounded-lg text-[10px] text-neutral-400 font-mono overflow-auto max-h-36 whitespace-pre leading-relaxed">
                    {htmlIframeCode}
                  </pre>
                </div>

                {/* PHP Plugin Generation */}
                <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 space-y-2">
                  <div className="flex justify-between items-center border-b border-neutral-800 pb-2">
                    <span className="text-[10px] font-bold text-emerald-400 font-mono">OPTION B: WP PLUGIN FILE (PHP)</span>
                    <button
                      onClick={() => copyText(phpFileCode, setCopiedPhp)}
                      className="p-1 px-2 hover:bg-neutral-800 text-[9.5px] font-bold rounded-md bg-neutral-850 border border-neutral-750 text-neutral-350 cursor-pointer flex items-center gap-1.5"
                    >
                      {copiedPhp ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedPhp ? 'COPIED!' : 'COPY PHP'}
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-500 leading-relaxed">
                    Save this snippet inside a file called <code>rcmc-ai-support.php</code> and upload it directly to your WordPress plugins suite. It registers beautifully under WP hooks.
                  </p>
                  <pre className="bg-neutral-950 p-2.5 rounded-lg text-[10px] text-emerald-100 font-mono overflow-auto max-h-36 whitespace-pre leading-relaxed">
                    {phpFileCode}
                  </pre>
                </div>

                {/* OPTION C: DOWNLOAD PRE-PACKAGED PLUGIN ZIP */}
                <div className="bg-neutral-900 p-4 rounded-xl border-2 border-emerald-500/20 space-y-3 shadow-md relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-emerald-500/10 text-emerald-400 text-[8px] px-2 py-0.5 rounded-bl-lg font-bold border-l border-b border-emerald-500/10 uppercase tracking-widest">
                    Recommended
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-neutral-100 uppercase tracking-wider flex items-center gap-1.5">
                      <FileCode className="w-4 h-4 text-emerald-400" /> OPTION C: DOWNLOAD PLUG-AND-PLAY ZIP
                    </h3>
                    <p className="text-[10.5px] text-neutral-400 mt-1 leading-relaxed">
                      Don't want to copy and paste code? Download our instant pre-configured ZIP archive containing the full plugin assets ready to be uploaded directly into your WordPress dashboard, active and active right away!
                    </p>
                  </div>

                  <button
                    onClick={handleDownloadZip}
                    disabled={downloadingZip}
                    className={`w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-850 disabled:text-neutral-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-lg transition-transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2 shadow-md ${downloadingZip ? 'animate-pulse' : ''}`}
                  >
                    {downloadingZip ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Generating WP ZIP...
                      </>
                    ) : (
                      <>
                        <FileCode className="w-4 h-4" />
                        Download WordPress Plugin (.zip)
                      </>
                    )}
                  </button>

                  <div className="bg-neutral-950/60 p-2.5 rounded-lg border border-neutral-850">
                    <h4 className="text-[9.5px] font-extrabold text-emerald-400 uppercase tracking-wider">How to install &amp; active:</h4>
                    <ul className="text-[10px] text-neutral-400 space-y-1 mt-1 list-decimal list-inside leading-snug">
                      <li>Click the button above to download <code>rcmc-ai-support.zip</code>.</li>
                      <li>Go to your WordPress Admin dashboard (<code>wp-admin</code>) on your live site.</li>
                      <li>Navigate to <strong className="text-neutral-200">Plugins &gt; Add New &gt; Upload Plugin</strong>.</li>
                      <li>Choose the downloaded file and click <strong className="text-neutral-200">Install Now</strong>.</li>
                      <li>Click <strong className="text-neutral-200">Activate Plugin</strong> once installed. The support chat widget is active immediately!</li>
                    </ul>
                  </div>
                </div>

              </div>
            )}

          </div>
        </div>

      </div>

    </div>
  );
}
