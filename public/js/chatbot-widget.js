/**
 * Pinnacle Bay 96 - Floating 3D Robot AI Concierge Chatbot Widget
 * public/js/chatbot-widget.js
 */

(function () {
  'use strict';

  // Prevent duplicate initialization
  if (window.__pbRobotWidgetInitialized) return;
  window.__pbRobotWidgetInitialized = true;

  // Injected CSS Styles for Floating 3D Robot Widget & Pop-up Chat Window
  const WIDGET_STYLES = `
    /* ======================================================================
       1. FLOATING CIRCULAR 3D ROBOT LAUNCHER BUTTON
       ====================================================================== */
    #pb-robot-launcher {
      position: fixed;
      bottom: 25px;
      right: 25px;
      z-index: 9999;
      width: 65px;
      height: 65px;
      border-radius: 50%;
      background: #ffffff;
      border: 2px solid #c5a880;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2), 0 0 15px rgba(197, 168, 128, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      outline: none;
      user-select: none;
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease;
      animation: pbRobotFloat 3s ease-in-out infinite;
    }

    #pb-robot-launcher:hover {
      transform: translateY(-5px) scale(1.06);
      box-shadow: 0 14px 30px rgba(0, 0, 0, 0.3), 0 0 25px rgba(197, 168, 128, 0.55);
      border-color: #dfc7a2;
    }

    /* Subtle Floating Bounce Micro-Animation */
    @keyframes pbRobotFloat {
      0%, 100% {
        transform: translateY(0);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2), 0 0 15px rgba(197, 168, 128, 0.35);
      }
      50% {
        transform: translateY(-8px);
        box-shadow: 0 16px 32px rgba(0, 0, 0, 0.25), 0 0 25px rgba(197, 168, 128, 0.5);
      }
    }

    /* Online Status Green Badge attached to Robot Launcher */
    #pb-robot-launcher .pb-status-badge {
      position: absolute;
      top: 2px;
      right: 2px;
      width: 14px;
      height: 14px;
      background: #10b981;
      border: 2.5px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 0 8px #10b981;
    }

    /* Attention Callout Tooltip */
    #pb-robot-tooltip {
      position: fixed;
      bottom: 35px;
      right: 100px;
      z-index: 9998;
      background: rgba(11, 17, 32, 0.95);
      border: 1px solid rgba(197, 168, 128, 0.4);
      color: #f8fafc;
      padding: 7px 14px;
      border-radius: 20px;
      font-family: 'Outfit', 'Inter', sans-serif;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
      pointer-events: none;
      opacity: 1;
      transform: translateX(0);
      transition: opacity 0.3s ease, transform 0.3s ease;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    #pb-robot-tooltip.pb-fade-out {
      opacity: 0;
      transform: translateX(10px);
      pointer-events: none;
    }

    /* ======================================================================
       2. POP-UP CHAT WINDOW (360px x 500px, 16px border-radius)
       ====================================================================== */
    #pb-chat-window {
      position: fixed;
      bottom: 100px;
      right: 25px;
      width: 360px;
      height: 500px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 120px);
      z-index: 9999;
      background: rgba(11, 17, 32, 0.97);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(197, 168, 128, 0.35);
      border-radius: 16px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.75), 0 0 25px rgba(197, 168, 128, 0.2);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: 'Inter', -apple-system, sans-serif;
      transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.3s;
      transform-origin: bottom right;
    }

    #pb-chat-window.pb-hidden {
      opacity: 0;
      transform: translateY(20px) scale(0.95);
      visibility: hidden;
      pointer-events: none;
    }

    /* Gradient Blue / Navy Header */
    .pb-chat-header {
      background: linear-gradient(135deg, #091224 0%, #172554 100%);
      padding: 14px 16px;
      border-bottom: 2px solid #c5a880;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }

    .pb-header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .pb-robot-badge {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #ffffff;
      border: 1.5px solid #c5a880;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 0 10px rgba(197, 168, 128, 0.3);
    }

    .pb-header-titles h4 {
      margin: 0;
      font-family: 'Outfit', sans-serif;
      font-size: 14px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: 0.3px;
    }

    .pb-header-titles p {
      margin: 2px 0 0 0;
      font-size: 10.5px;
      color: #94a3b8;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .pb-header-titles .pb-online-dot {
      width: 7px;
      height: 7px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 6px #10b981;
    }

    .pb-header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .pb-btn-close {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #e2e8f0;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      transition: all 0.2s;
    }

    .pb-btn-close:hover {
      background: rgba(239, 68, 68, 0.25);
      color: #ef4444;
      border-color: #ef4444;
      transform: scale(1.05);
    }

    /* Quick Suggestions Bar */
    .pb-suggestions-bar {
      padding: 8px 12px;
      background: rgba(15, 23, 42, 0.9);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      display: flex;
      gap: 6px;
      overflow-x: auto;
      white-space: nowrap;
      scrollbar-width: none;
      flex-shrink: 0;
    }

    .pb-suggestions-bar::-webkit-scrollbar {
      display: none;
    }

    .pb-chip {
      background: rgba(197, 168, 128, 0.12);
      border: 1px solid rgba(197, 168, 128, 0.35);
      color: #f1f5f9;
      font-size: 10.5px;
      font-weight: 500;
      padding: 4px 10px;
      border-radius: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      flex-shrink: 0;
      font-family: inherit;
    }

    .pb-chip:hover {
      background: #c5a880;
      color: #0b1120;
      border-color: #c5a880;
      transform: translateY(-1px);
    }

    /* Scrollable Chat Body */
    .pb-chat-body {
      flex: 1;
      padding: 14px 12px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scrollbar-width: thin;
      scrollbar-color: rgba(197, 168, 128, 0.25) transparent;
    }

    .pb-chat-body::-webkit-scrollbar {
      width: 4px;
    }

    .pb-chat-body::-webkit-scrollbar-thumb {
      background: rgba(197, 168, 128, 0.3);
      border-radius: 8px;
    }

    /* Message Rows & Bubbles */
    .pb-msg-row {
      display: flex;
      width: 100%;
      animation: pbFadeIn 0.25s ease-out;
    }

    @keyframes pbFadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .pb-msg-row.user {
      justify-content: flex-end;
    }

    .pb-msg-row.bot {
      justify-content: flex-start;
    }

    .pb-bubble {
      max-width: 88%;
      padding: 10px 14px;
      border-radius: 14px;
      font-size: 13px;
      line-height: 1.45;
      word-break: break-word;
    }

    .pb-msg-row.user .pb-bubble {
      background: linear-gradient(135deg, #c5a880 0%, #b8976b 100%);
      color: #070a13;
      font-weight: 600;
      border-bottom-right-radius: 3px;
      box-shadow: 0 4px 12px rgba(197, 168, 128, 0.25);
    }

    .pb-msg-row.bot .pb-bubble {
      background: rgba(30, 41, 59, 0.85);
      border: 1px solid rgba(197, 168, 128, 0.2);
      color: #f1f5f9;
      border-bottom-left-radius: 3px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    /* Typing Indicator with Text */
    .pb-typing-box {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid rgba(197, 168, 128, 0.2);
      border-radius: 12px;
      font-size: 11.5px;
      color: #94a3b8;
      width: fit-content;
    }

    .pb-typing-dots {
      display: inline-flex;
      gap: 3px;
    }

    .pb-dot {
      width: 5px;
      height: 5px;
      background: #c5a880;
      border-radius: 50%;
      animation: pbBounce 1.4s infinite ease-in-out both;
    }

    .pb-dot:nth-child(1) { animation-delay: -0.32s; }
    .pb-dot:nth-child(2) { animation-delay: -0.16s; }

    @keyframes pbBounce {
      0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
      40% { transform: scale(1); opacity: 1; }
    }

    /* ======================================================================
       3. COMPACT ROOM RECOMMENDATION CARDS
       ====================================================================== */
    .pb-rooms-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 8px;
      width: 100%;
    }

    .pb-room-card {
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid rgba(197, 168, 128, 0.3);
      border-radius: 12px;
      padding: 11px 12px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
      transition: all 0.25s ease;
    }

    .pb-room-card:hover {
      border-color: #c5a880;
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.6), 0 0 12px rgba(197, 168, 128, 0.2);
    }

    .pb-room-card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;
    }

    .pb-room-card-title {
      font-family: 'Outfit', sans-serif;
      font-size: 13.5px;
      font-weight: 700;
      color: #ffffff;
      margin: 0;
    }

    .pb-room-badge-num {
      font-size: 10px;
      font-family: monospace;
      padding: 2px 6px;
      border-radius: 5px;
      background: rgba(197, 168, 128, 0.15);
      color: #c5a880;
      border: 1px solid rgba(197, 168, 128, 0.3);
      font-weight: 700;
    }

    .pb-room-price-line {
      font-size: 14px;
      font-weight: 800;
      color: #10b981;
      margin-bottom: 5px;
    }

    .pb-room-amenities {
      font-size: 10.5px;
      color: #94a3b8;
      line-height: 1.35;
      margin-bottom: 8px;
    }

    .pb-btn-select-book {
      width: 100%;
      background: linear-gradient(135deg, #c5a880 0%, #b3946c 100%);
      color: #070a13;
      border: none;
      padding: 7px 10px;
      border-radius: 7px;
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      font-size: 11.5px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      transition: all 0.2s ease;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .pb-btn-select-book:hover {
      background: #dfc7a2;
      box-shadow: 0 4px 12px rgba(197, 168, 128, 0.4);
      transform: translateY(-1px);
    }

    /* ======================================================================
       4. CHAT INPUT BAR
       ====================================================================== */
    .pb-chat-footer {
      padding: 10px 12px;
      background: rgba(7, 10, 19, 0.98);
      border-top: 1px solid rgba(197, 168, 128, 0.2);
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .pb-input-text {
      flex: 1;
      background: rgba(30, 41, 59, 0.65);
      border: 1px solid rgba(197, 168, 128, 0.25);
      border-radius: 20px;
      padding: 8px 14px;
      color: #ffffff;
      font-size: 12.5px;
      outline: none;
      transition: all 0.2s ease;
      font-family: inherit;
    }

    .pb-input-text:focus {
      border-color: #c5a880;
      background: rgba(30, 41, 59, 0.9);
      box-shadow: 0 0 10px rgba(197, 168, 128, 0.2);
    }

    .pb-input-text::placeholder {
      color: #64748b;
    }

    .pb-btn-send {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: linear-gradient(135deg, #c5a880 0%, #b3946c 100%);
      color: #070a13;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }

    .pb-btn-send:hover {
      transform: scale(1.06);
      background: #dfc7a2;
      box-shadow: 0 0 12px rgba(197, 168, 128, 0.4);
    }

    .pb-btn-send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    @media (max-width: 480px) {
      #pb-chat-window {
        bottom: 90px;
        right: 14px;
        width: calc(100vw - 28px);
        height: calc(100vh - 110px);
      }
      #pb-robot-launcher {
        bottom: 18px;
        right: 18px;
        width: 60px;
        height: 60px;
      }
      #pb-robot-tooltip {
        display: none;
      }
    }
  `;

  // 3D AI Robot SVG Icon (Metallic Sphere, Cyan Visor, Gold Concierge Headset)
  const ROBOT_ICON_SVG = `
    <svg width="44" height="44" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Antenna -->
      <line x1="32" y1="13" x2="32" y2="6" stroke="#c5a880" stroke-width="3" stroke-linecap="round"/>
      <circle cx="32" cy="5" r="4" fill="url(#pbAntennaGlow)"/>
      
      <!-- Robot Head Base (3D Sphere gradient) -->
      <rect x="12" y="13" width="40" height="34" rx="17" fill="url(#pbRobotHeadGrad)" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.12))"/>
      <rect x="12.5" y="13.5" width="39" height="33" rx="16.5" stroke="url(#pbHeadBorderGrad)" stroke-width="1.2"/>

      <!-- Specular Glossy Highlight -->
      <ellipse cx="26" cy="19" rx="10" ry="4" fill="#ffffff" opacity="0.6"/>

      <!-- Headset & Ears -->
      <rect x="8" y="24" width="5" height="11" rx="2.5" fill="#c5a880"/>
      <rect x="51" y="24" width="5" height="11" rx="2.5" fill="#c5a880"/>
      <path d="M10 32 C10 43 22 45 25 45" stroke="#c5a880" stroke-width="2.5" stroke-linecap="round" fill="none"/>
      <circle cx="26" cy="45" r="2.5" fill="#38bdf8"/>

      <!-- Dark Visor Screen -->
      <rect x="16" y="21" width="32" height="18" rx="9" fill="url(#pbVisorGrad)" stroke="#1e293b" stroke-width="1"/>
      <!-- Visor Curve Light Reflection -->
      <path d="M19 25 Q32 23 45 25" stroke="#ffffff" stroke-width="1" opacity="0.25" fill="none"/>

      <!-- Glowing Cyan Eyes -->
      <rect x="22" y="26" width="6" height="7" rx="3" fill="#38bdf8" filter="drop-shadow(0 0 4px #06b6d4)"/>
      <rect x="36" y="26" width="6" height="7" rx="3" fill="#38bdf8" filter="drop-shadow(0 0 4px #06b6d4)"/>
      <circle cx="24" cy="28" r="1.2" fill="#ffffff"/>
      <circle cx="38" cy="28" r="1.2" fill="#ffffff"/>

      <!-- Friendly Smile Line -->
      <path d="M28 35 Q32 38 36 35" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round" fill="none"/>

      <!-- Concierge Gold Bowtie -->
      <path d="M28 50 L32 52 L36 50 L32 54 Z" fill="#c5a880"/>
      <circle cx="32" cy="52" r="1.8" fill="#ffffff"/>

      <!-- Shaders & Gradients -->
      <defs>
        <radialGradient id="pbAntennaGlow" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#38bdf8"/>
          <stop offset="100%" stop-color="#0284c7"/>
        </radialGradient>
        <linearGradient id="pbRobotHeadGrad" x1="12" y1="13" x2="52" y2="47" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="65%" stop-color="#f8fafc"/>
          <stop offset="100%" stop-color="#cbd5e1"/>
        </linearGradient>
        <linearGradient id="pbHeadBorderGrad" x1="12" y1="13" x2="52" y2="47" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="100%" stop-color="#94a3b8"/>
        </linearGradient>
        <linearGradient id="pbVisorGrad" x1="16" y1="21" x2="48" y2="39" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#020617"/>
        </linearGradient>
      </defs>
    </svg>
  `;

  // HTML Structure of the Widget
  const WIDGET_HTML = `
    <!-- 1. Floating 3D Robot Launcher Button -->
    <div id="pb-robot-launcher" role="button" aria-label="Open Pinnacle Bay AI Concierge" title="Chat with Pinnacle Bay AI Assistant">
      <span class="pb-status-badge"></span>
      ${ROBOT_ICON_SVG}
    </div>

    <!-- Callout Tooltip -->
    <div id="pb-robot-tooltip">
      <span>AI Concierge</span>
    </div>

    <!-- 2. Pop-up Chat Window -->
    <div id="pb-chat-window" class="pb-hidden" role="dialog" aria-labelledby="pbAiTitle">
      <!-- Blue/Navy Gradient Header -->
      <div class="pb-chat-header">
        <div class="pb-header-left">
          <div class="pb-robot-badge">
            <svg width="24" height="24" viewBox="0 0 64 64" fill="none">
              <rect x="12" y="13" width="40" height="34" rx="17" fill="#f8fafc"/>
              <rect x="16" y="21" width="32" height="18" rx="9" fill="#0f172a"/>
              <circle cx="25" cy="30" r="3" fill="#38bdf8"/>
              <circle cx="39" cy="30" r="3" fill="#38bdf8"/>
              <path d="M28 35 Q32 37 36 35" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round" fill="none"/>
              <circle cx="32" cy="7" r="3" fill="#38bdf8"/>
              <line x1="32" y1="13" x2="32" y2="8" stroke="#c5a880" stroke-width="2"/>
            </svg>
          </div>
          <div class="pb-header-titles">
            <h4 id="pbAiTitle">Pinnacle Bay AI Assistant</h4>
            <p><span class="pb-online-dot"></span> Virtual Hotel Concierge • Online</p>
          </div>
        </div>
        <div class="pb-header-actions">
          <button type="button" class="pb-btn-close" id="pb-btn-close-chat" title="Close Chat" aria-label="Close Chat">✕</button>
        </div>
      </div>

      <!-- Quick Suggestion Chips -->
      <div class="pb-suggestions-bar">
        <button type="button" class="pb-chip" data-query="Rooms under 30000">Rooms under 30,000</button>
        <button type="button" class="pb-chip" data-query="Deluxe with breakfast">Deluxe with Breakfast</button>
        <button type="button" class="pb-chip" data-query="Couple Room with AC">Couple Room (A/C)</button>
        <button type="button" class="pb-chip" data-query="Family Suite">Family Suite</button>
        <button type="button" class="pb-chip" data-query="Cheapest room available">Cheapest Available</button>
      </div>

      <!-- Scrollable Chat Body -->
      <div class="pb-chat-body" id="pb-chat-body"></div>

      <!-- Chat Input Bar -->
      <form class="pb-chat-footer" id="pb-chat-form">
        <input 
          type="text" 
          class="pb-input-text" 
          id="pb-input-text" 
          placeholder="Ask for rooms or budget (e.g. 'under 30000')..." 
          autocomplete="off"
        />
        <button type="submit" class="pb-btn-send" id="pb-btn-send-msg" title="Send message" aria-label="Send message">
          <!-- Paper-plane icon -->
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
    </div>
  `;

  // Welcome message mandated by prompt
  const WELCOME_MESSAGE = "Hello! 👋 I am your Pinnacle Bay AI concierge. Looking for budget rooms, packages, or luxury suites? Ask me (e.g., 'Rooms under 30000' or 'Deluxe with breakfast').";

  /**
   * Initializes Widget in DOM
   */
  function initRobotWidget() {
    // 1. Remove previous root if any
    const existingRoot = document.getElementById('pb-robot-widget-root');
    if (existingRoot) existingRoot.remove();
    const existingStyles = document.getElementById('pb-robot-widget-styles');
    if (existingStyles) existingStyles.remove();

    // 2. Inject CSS
    const styleTag = document.createElement('style');
    styleTag.id = 'pb-robot-widget-styles';
    styleTag.innerHTML = WIDGET_STYLES;
    document.head.appendChild(styleTag);

    // 3. Inject HTML
    const container = document.createElement('div');
    container.id = 'pb-robot-widget-root';
    container.innerHTML = WIDGET_HTML;
    document.body.appendChild(container);

    // 4. Element Selectors
    const launcherBtn = document.getElementById('pb-robot-launcher');
    const chatWindow = document.getElementById('pb-chat-window');
    const closeBtn = document.getElementById('pb-btn-close-chat');
    const chatBody = document.getElementById('pb-chat-body');
    const chatForm = document.getElementById('pb-chat-form');
    const inputField = document.getElementById('pb-input-text');
    const chips = container.querySelectorAll('.pb-chip');
    const tooltip = document.getElementById('pb-robot-tooltip');

    let isBusy = false;

    // 5. Append Initial Bot Message
    appendBotMessage(WELCOME_MESSAGE);

    // Fade out tooltip after 6 seconds
    setTimeout(() => {
      if (tooltip) tooltip.classList.add('pb-fade-out');
    }, 6000);

    // 6. Open / Close Controls
    function openChat() {
      chatWindow.classList.remove('pb-hidden');
      if (tooltip) tooltip.classList.add('pb-fade-out');
      setTimeout(() => {
        if (inputField) inputField.focus();
      }, 150);
    }

    function closeChat() {
      chatWindow.classList.add('pb-hidden');
    }

    if (launcherBtn) {
      launcherBtn.addEventListener('click', () => {
        if (chatWindow.classList.contains('pb-hidden')) {
          openChat();
        } else {
          closeChat();
        }
      });
    }

    if (closeBtn) closeBtn.addEventListener('click', closeChat);

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !chatWindow.classList.contains('pb-hidden')) {
        closeChat();
      }
    });

    // 7. Quick Suggestion Chips Listener
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const query = chip.getAttribute('data-query');
        if (query && !isBusy) {
          sendUserQuery(query);
        }
      });
    });

    // 8. Form Submission Listener
    if (chatForm) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = inputField.value.trim();
        if (text && !isBusy) {
          sendUserQuery(text);
          inputField.value = '';
        }
      });
    }

    /**
     * Appends user message row
     */
    function appendUserMessage(text) {
      const row = document.createElement('div');
      row.className = 'pb-msg-row user';
      row.innerHTML = `<div class="pb-bubble">${escapeHtml(text)}</div>`;
      chatBody.appendChild(row);
      scrollToBottom();
    }

    /**
     * Appends bot response row with text and compact room recommendation cards
     */
    function appendBotMessage(text, rooms = []) {
      const row = document.createElement('div');
      row.className = 'pb-msg-row bot';

      let cardsHtml = '';
      if (rooms && rooms.length > 0) {
        cardsHtml = `<div class="pb-rooms-list">`;
        rooms.forEach(room => {
          const roomNum = escapeHtml(room.room_number || '101');
          const roomType = escapeHtml(room.room_type || room.category || 'Deluxe Room');
          const category = escapeHtml(room.category || room.room_type || 'Deluxe Room');
          const priceStr = room.price_formatted || `Rs. ${Number(room.price || 25000).toLocaleString('en-LK')}`;
          const amenities = escapeHtml(room.features || 'AC, Free Breakfast, Pool Access');

          cardsHtml += `
            <div class="pb-room-card">
              <div class="pb-room-card-head">
                <h5 class="pb-room-card-title">${roomType}</h5>
                <span class="pb-room-badge-num">Room #${roomNum}</span>
              </div>
              <div class="pb-room-price-line">${priceStr} <span style="font-size: 11px; font-weight: normal; color: #94a3b8;">/ night</span></div>
              <div class="pb-room-amenities">✦ ${amenities}</div>
              <button type="button" class="pb-btn-select-book" data-room-type="${category}" data-room-num="${roomNum}">
                Select / Book
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            </div>
          `;
        });
        cardsHtml += `</div>`;
      }

      row.innerHTML = `
        <div class="pb-bubble">
          <div>${escapeHtml(text)}</div>
          ${cardsHtml}
        </div>
      `;

      chatBody.appendChild(row);

      // Attach "Select / Book" click handlers
      row.querySelectorAll('.pb-btn-select-book').forEach(btn => {
        btn.addEventListener('click', () => {
          const rType = btn.getAttribute('data-room-type');
          const rNum = btn.getAttribute('data-room-num');
          handleSelectBookClick(rType, rNum);
        });
      });

      scrollToBottom();
    }

    /**
     * Subtle typing indicator ("Assistant is searching available rooms...")
     */
    function showTypingIndicator() {
      const typingEl = document.createElement('div');
      typingEl.className = 'pb-msg-row bot';
      typingEl.id = 'pb-typing-indicator';
      typingEl.innerHTML = `
        <div class="pb-typing-box">
          <span>Assistant is searching available rooms...</span>
          <div class="pb-typing-dots">
            <span class="pb-dot"></span>
            <span class="pb-dot"></span>
            <span class="pb-dot"></span>
          </div>
        </div>
      `;
      chatBody.appendChild(typingEl);
      scrollToBottom();
    }

    function removeTypingIndicator() {
      const el = document.getElementById('pb-typing-indicator');
      if (el) el.remove();
    }

    function scrollToBottom() {
      chatBody.scrollTop = chatBody.scrollHeight;
    }

    /**
     * Sends user query to backend: POST /api/chatbot/query
     */
    async function sendUserQuery(text) {
      if (isBusy) return;
      isBusy = true;

      appendUserMessage(text);
      showTypingIndicator();

      try {
        const response = await fetch('/api/chatbot/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text })
        });

        const data = await response.json();
        removeTypingIndicator();

        if (data && data.reply) {
          appendBotMessage(data.reply, data.rooms || []);
        } else {
          appendBotMessage("Here are our recommended rooms at Pinnacle Bay 96:", data.rooms || []);
        }
      } catch (err) {
        console.error('[RobotChatbot] Network error:', err);
        removeTypingIndicator();
        appendBotMessage("I apologize, but I could not connect to the reservation system right now. Please try again.");
      } finally {
        isBusy = false;
      }
    }

    /**
     * Auto-populates the booking form when "Select / Book" is clicked
     */
    function handleSelectBookClick(roomType, roomNumber) {
      console.log(`[RobotChatbot] Select / Book clicked: ${roomType} (Room #${roomNumber})`);

      // Close chat window
      closeChat();

      // Trigger landing page booking modal
      if (typeof window.openGuestBookingModal === 'function') {
        window.openGuestBookingModal(roomType);
      } else {
        const modal = document.getElementById('guestBookingModal');
        if (modal) {
          if (typeof modal.showModal === 'function') modal.showModal();
          else modal.style.display = 'block';
        }
      }

      // Pre-select Room Type dropdown
      const roomSelect = document.getElementById('guestRoomType') || document.getElementById('bookRoomType');
      if (roomSelect) {
        for (let i = 0; i < roomSelect.options.length; i++) {
          if (roomSelect.options[i].value.toLowerCase().includes(roomType.toLowerCase())) {
            roomSelect.selectedIndex = i;
            break;
          }
        }
      }

      // Pre-populate preferred room number in special requests field
      const notesInput = document.getElementById('guestSpecialRequests') || document.getElementById('bookNotes');
      if (notesInput && roomNumber) {
        const prefText = `Preferred Room: #${roomNumber}`;
        if (!notesInput.value.includes(prefText)) {
          notesInput.value = notesInput.value ? `${notesInput.value} | ${prefText}` : prefText;
        }
      }

      // Re-trigger calculation in booking engine
      if (typeof window.updateGuestBookingPricing === 'function') {
        window.updateGuestBookingPricing();
      }

      // Smooth scroll to booking form
      const modalEl = document.getElementById('guestBookingModal');
      if (modalEl) {
        modalEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
  }

  // Auto-init on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRobotWidget);
  } else {
    initRobotWidget();
  }
})();
