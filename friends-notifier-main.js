/**
 * @author Cat Bot (Adapted by Google Gemini)
 *
 * This script provides friend activity notifications (connect/disconnect/status changes)
 * within the League of Legends client. It includes:
 * - Real-time observation of friend list and friend request changes.
 * - Toast notifications for key events.
 * - Playback of distinct sounds for different event types.
 * - An in-game history panel to view past events.
 * - A draggable and fully resizable history panel with persistent position and size.
 * - Integration with the League Client's UI to add a toggle button for the history panel.
 * - Robust error handling and console logging for debugging.
 * - New: Option to filter notifications by specific friends or friend groups.
 * - New: Search bar for filtering friends in the settings panel.
 * - New: Option to choose between different types of notifications (toasts/logs).
 * - New: Option to choose between different types of sound notifications.
 * - New: Volume control for sound notifications.
 * - New: Clear log history button.
 * - New: Global mute/unmute option for all notifications.
 * - New: Panel background opacity control.
 * - New: Customizable sound packs for notifications (Default, Chime, Click).
 * - New: In-log display of custom text-based emotes as emojis/images.
 * - New: Enhanced friend status messages to include more game details.
 * - New: Option to launch history panel on game startup.
 * - New: Persistent friend statistics and a dedicated UI panel to view them.
 * - New: Button in History Panel to toggle Stats Panel.
 * - Update: Only one toggle button (History) in the main client UI.
 * - New: Periodically (every 10 seconds) removes extra instances of the custom 'History' button
 * to prevent duplication issues due to dynamic UI rendering.
 *
 * This version is self-contained, with domListener and theme.css inlined to prevent import issues.
 *
 * NEW FEATURES ADDED:
 * - Customizable Notification Positions: Users can choose where toast notifications appear.
 * - Notification Timeout: Users can set how long toast notifications remain visible.
 * - Visual Cues for Status Changes: Small colored dots convey friend status in the log.
 * - "Go to Profile" Button: A button in log entries allows direct navigation to a friend's profile.
 */

// Define groupIcon content directly for the button SVG.
const groupIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20px" height="20px">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.09.68 1.95 1.61 2.54 2.76.3.58.43 1.25.43 1.79V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
</svg>`;

const statsIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20px" height="20px">
    <path d="M16 11V3H8v8H2v10h20V11h-6zm-6 0V5h4v6h-4zm-4 8v-6h2v6H6zm12 0h-2v-6h2v6z"/>
</svg>`;


// --- GLOBAL VARIABLES ---
const logs = []; // Stores a history of connection/disconnection events
const lastStatus = []; // Keeps track of the last known availability for each friend
let friends; // Stores the current list of friends
let friendsReqs; // Stores pending friend requests
let friendsGroups = []; // Stores fetched friend groups
let lastMyStatus = null; // Stores the last known availability for the current user

let logPanelElement = null; // Global reference to the history panel HTMLElement
let statsPanelElement = null; // Global reference to the new stats panel HTMLElement
let toastContainerElement = null; // Global reference to the toast container element

// Flags for notifier state and panel visibility, persisted via PenguLoader's DataStore
let enabled = DataStore.get('RN_enabled', true);
let isLogPanelVisible = DataStore.get('RN_log_panel_visible', true); // Renamed for clarity
let isStatsPanelVisible = DataStore.get('RN_stats_panel_visible', false); // New: for stats panel visibility

// Default filter settings, including new sound notification options and new features
const defaultFilterSettings = {
    mode: 'whitelist', // 'whitelist' or 'blacklist'
    selectedFriends: {}, // { 'friendId': true/false }
    selectedGroups: {},   // { 'groupName': true/false }
    // Toast/Log notification type settings
    notifyOnConnect: true,
    notifyOnDisconnect: true,
    notifyOnStatusChange: true,
    notifyOnFriendRemoved: true,
    notifyOnFriendAdded: true,
    notifyOnFriendRequestReceived: true,
    notifyOnFriendRequestDeleted: true,
    notifyOnMyStatusChange: true,
    // Sound notification type settings
    soundOnConnect: true,
    soundOnDisconnect: true,
    soundOnStatusChange: true,
    soundOnFriendRemoved: true,
    soundOnFriendAdded: true,
    soundOnFriendRequestReceived: true,
    soundOnFriendRequestDeleted: true,
    soundOnMyStatusChange: true,
    soundVolume: 0.3, // Default sound volume (0.0 to 1.0)
    isGloballyMuted: false, // New: Global mute for all notifications (toasts and sounds)
    panelOpacity: 0.9, // New: Opacity for the panel background (0.0 to 1.0)
    selectedSoundPack: 'default', // New: Default sound pack
    displayEmotesInLog: true, // New: Enable/disable emote display in log
    launchPanelOnStartup: true, // New: Determines if panel opens automatically on client launch
    toastPosition: 'top-right', // New: Default toast notification position
    toastDuration: 5 // New: Default toast display duration in seconds
};

// Load filter settings from DataStore, merging with defaults to handle new properties
let filterSettings = { ...defaultFilterSettings, ...DataStore.get('RN_filter_settings', {}) };
// Ensure nested objects are initialized if not present (e.g., if it's the very first run)
filterSettings.selectedFriends = filterSettings.selectedFriends || {};
filterSettings.selectedGroups = filterSettings.selectedGroups || {};


// Current search query for friends in the settings panel
let friendSearchQuery = '';
let statsPanelFriendSearchQuery = ''; // New: search query for the stats panel

// Flag to manage settings panel visibility within the main panel
let isSettingsPanelVisible = false; // Initial state: show logs, not settings

// Minimum dimensions for the custom log panel
const MIN_PANEL_WIDTH = 200;
const MIN_PANEL_HEIGHT = 150;
const PANEL_MARGIN = 20; // Margin from the bottom and right edges

// Initial custom log panel size (default values)
let logPanelSize = DataStore.get('RN_log_panel_size', { width: 350, height: 400 });
let logPanelPosition = DataStore.get('RN_log_panel_position', {
    top: window.innerHeight - logPanelSize.height - PANEL_MARGIN,
    left: window.innerWidth - logPanelSize.width - PANEL_MARGIN
});

// New: Initial stats panel size and position
let statsPanelSize = DataStore.get('RN_stats_panel_size', { width: 400, height: 500 });
let statsPanelPosition = DataStore.get('RN_stats_panel_position', { top: 50, left: 50 });


// --- Friend Statistics Data Structure ---
let friendStats = DataStore.get('RN_friend_stats', {});
/*
Example structure for friendStats:
{
    "friendId1": {
        name: "Friend Name",
        riotId: "GameName#Tag",
        profileIcon: 1234,
        lastConnectedTimestamp: null, // ISO string
        lastDisconnectedTimestamp: null, // ISO string
        totalOnlineTime: 0, // in milliseconds
        totalOfflineTime: 0, // in milliseconds (time spent offline since tracking started)
        statusChanges: 0,
        isConnected: false,
        lastStatusUpdate: "ISO_TIMESTAMP" // Last time this entry was updated
    },
    "friendId2": { ... }
}
*/


// --- DOM Change Listener Utility (INLINED from domListener.js) ---
const domChange = {
    on(callback) {
        document.body.addEventListener("DOMNodeInserted", callback);
        document.body.addEventListener("DOMNodeRemoved", callback);
    },
    off(callback) {
        // Corrected: Use removeEventListener for both events
        document.body.removeEventListener("DOMNodeInserted", callback);
        document.body.removeEventListener("DOMNodeRemoved", callback);
    }
};

// --- GLOBAL MOUSE DOWN LISTENER FOR DEBUGGING ---
// This will help us identify what element is actually receiving the mousedown event.
window.addEventListener('mousedown', (e) => {
    // console.log('FriendsNotifier Debug: Global mousedown target:', e.target); // Too chatty for constant logging
}, true); // Use capture phase to ensure it runs before other handlers

// --- UI PANEL STYLES (INLINED from theme.css and existing panel styles) ---
// Using a template literal for dynamic styles based on initial panelPosition and panelSize
const panelStyles = `
    /* Styles from theme.css */
    .lol-social-lower-pane-container {
        transition: all .4s, transform 1s;
    }

    .friends-invis {
        opacity: 0;
        pointer-events: none;
        transform: translateY(50%);
    }

    /* Original friends-button from theme.css, keeping it here in case it's used elsewhere in client */
    /* This style might conflict with existing client buttons, we will try to remove them */
    .friends-button {
        position: relative;
        transition: all .3s;
        color: rgb(205, 190, 145);
        border: 1.5px solid rgb(205, 190, 145);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        background-color: rgb(32, 35, 40);
        transition: color .3s;
    }

    .friends-button::after {
        content: "";
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        mix-blend-mode: overlay;
        background-image: linear-gradient(to bottom, rgb(32, 35, 40), rgb(243, 229, 186));
        opacity: 0;
        transition: opacity .3s;
        background-position: center bottom;
        background-size: 100% 200%;
    }

    .friends-button:hover::after {
        opacity: 1;
    }

    /* Styles for the FriendsNotifier Log Panel */
    #friends-notifier-log-panel {
        position: absolute;
        top: ${logPanelPosition.top}px; /* Will be updated by repositionPanel */
        left: ${logPanelPosition.left}px; /* Will be updated by repositionPanel */
        width: ${logPanelSize.width}px;
        height: ${logPanelSize.height}px;
        background-color: rgba(32, 35, 40, ${filterSettings.panelOpacity}); /* Dynamic opacity */
        border: 1.5px solid rgb(205, 190, 145);
        border-radius: 8px;
        z-index: 2147483647; /* Max z-index value to ensure it's on top */
        display: flex; /* Ensure flexbox for column layout */
        flex-direction: column;
        overflow: hidden;
        font-family: 'Arial', sans-serif;
        color: rgb(205, 190, 145);
        font-size: 12px;
        box-shadow: 0 0 15px rgba(0,0,0,0.5);
        min-width: ${MIN_PANEL_WIDTH}px; /* Enforce minimum size */
        min-height: ${MIN_PANEL_HEIGHT}px; /* Enforce minimum size */
        pointer-events: all !important; /* Ensure the panel itself can receive events */
    }

    /* Styles for the FriendsNotifier Stats Panel */
    #friends-notifier-stats-panel {
        position: absolute;
        top: ${statsPanelPosition.top}px; /* Will be updated by repositionPanel */
        left: ${statsPanelPosition.left}px; /* Will be updated by repositionPanel */
        width: ${statsPanelSize.width}px;
        height: ${statsPanelSize.height}px;
        background-color: rgba(32, 35, 40, ${filterSettings.panelOpacity}); /* Dynamic opacity */
        border: 1.5px solid rgb(205, 190, 145);
        border-radius: 8px;
        z-index: 2147483646; /* One less than log panel, can be adjusted */
        display: none; /* Hidden by default */
        flex-direction: column;
        overflow: hidden;
        font-family: 'Arial', sans-serif;
        color: rgb(205, 190, 145);
        font-size: 12px;
        box-shadow: 0 0 15px rgba(0,0,0,0.5);
        min-width: ${MIN_PANEL_WIDTH}px;
        min-height: ${MIN_PANEL_HEIGHT}px;
        pointer-events: all !important;
    }

    #friends-notifier-panel-header, #friends-notifier-stats-header {
        padding: 10px;
        background-color: rgba(20, 20, 20, 0.9);
        border-bottom: 1px solid rgb(205, 190, 145);
        font-weight: bold;
        text-align: center;
        cursor: grab;
        display: flex;
        justify-content: space-between;
        align-items: center;
        z-index: inherit;
        pointer-events: auto !important;
        color: rgb(205, 190, 145);
    }
    #friends-notifier-panel-header.dragging, #friends-notifier-stats-header.dragging {
        cursor: grabbing;
    }
    #friends-notifier-panel-header-title, #friends-notifier-stats-header-title {
        flex-grow: 1;
        text-align: center;
    }
    #friends-notifier-panel-header-buttons, #friends-notifier-stats-header-buttons {
        display: flex;
        gap: 5px;
    }
    #friends-notifier-panel-settings-btn,
    #friends-notifier-panel-clear-log-btn,
    #friends-notifier-panel-stats-btn, /* New style for stats button in log panel header */
    #friends-notifier-panel-close,
    #friends-notifier-stats-close { /* New: stats panel close button */
        background: none;
        border: none;
        color: rgb(205, 190, 145);
        font-size: 16px;
        cursor: pointer;
        padding: 0 5px;
        line-height: 1;
        pointer-events: auto !important;
        transition: color .3s;
    }
    #friends-notifier-panel-settings-btn:hover,
    #friends-notifier-panel-clear-log-btn:hover,
    #friends-notifier-panel-stats-btn:hover, /* Hover for new button */
    #friends-notifier-panel-close:hover,
    #friends-notifier-stats-close:hover {
        color: rgb(255, 244, 213);
    }
    /* Specific size for close button icon */
    #friends-notifier-panel-close, #friends-notifier-stats-close {
        font-size: 18px;
    }

    #friends-notifier-panel-content, #friends-notifier-stats-content { /* Common styles for content areas */
        flex-grow: 1;
        overflow-y: auto;
        padding: 10px;
        line-height: 1.5;
        display: flex;
        flex-direction: column-reverse; /* For log panel, new for stats panel */
        pointer-events: auto !important;
    }
    #friends-notifier-stats-content {
        flex-direction: column; /* For stats panel, order normally */
    }

    .log-entry {
        margin-bottom: 5px;
        word-wrap: break-word;
        border-bottom: 1px dotted rgba(255,255,255,0.1);
        padding-bottom: 3px;
    }
    .log-entry:last-child {
        border-bottom: none;
    }
    .log-entry .timestamp {
        color: #888;
        font-size: 10px;
        margin-right: 5px;
        white-space: nowrap;
    }
    .log-entry .type {
        font-weight: bold;
        margin-right: 5px;
    }
    .log-entry.connected { color: #66cc66; }
    .log-entry.disconnected { color: #ff6666; }
    .log-entry.status-change { color: #99bbff; }
    .log-entry.friend-removed { color: #ffaa66; }
    .log-entry.friend-added { color: #ffff66; }
    .log-entry.friend-request-received { color: #ffff66; }
    .log-entry.friend-request-deleted { color: #ffaa66; }
    .log-entry.my-status { color: #cc99ff; }
    .log-entry img.emote {
        vertical-align: middle;
        height: 1em;
        width: 1em;
        margin: 0 2px;
    }

    #friends-notifier-panel-content::-webkit-scrollbar,
    #friends-notifier-stats-content::-webkit-scrollbar {
        width: 8px;
    }
    #friends-notifier-panel-content::-webkit-scrollbar-track,
    #friends-notifier-stats-content::-webkit-scrollbar-track {
        background: #222;
        border-radius: 4px;
    }
    #friends-notifier-panel-content::-webkit-scrollbar-thumb,
    #friends-notifier-stats-content::-webkit-scrollbar-thumb {
        background: #555;
        border-radius: 4px;
    }
    #friends-notifier-panel-content::-webkit-scrollbar-thumb:hover,
    #friends-notifier-stats-content::-webkit-scrollbar-thumb:hover {
        background: #777;
    }

    /* Specific styles for the one toggle button that appears in the client's social bar */
    .friends-notifier-toggle-button[data-friends-notifier-button="true"] { /* Target ONLY our history button */
        position: relative;
        transition: all .3s;
        color: rgb(205, 190, 145);
        border: 1.5px solid rgb(205, 190, 145);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        background-color: rgb(32, 35, 40);
        transition: color .3s;
        padding: 5px 10px;
        border-radius: 4px;
        font-weight: bold;
        text-transform: uppercase;
        font-size: 12px;
        height: 30px;
        min-width: 80px;
        gap: 5px;
    }
    .friends-notifier-toggle-button[data-friends-notifier-button="true"] svg.friends-notifier-button-icon {
        width: 16px;
        height: 16px;
        fill: currentColor;
    }

    .friends-notifier-toggle-button[data-friends-notifier-button="true"]::after {
        content: "";
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        mix-blend-mode: overlay;
        background-image: linear-gradient(to bottom, rgb(32, 35, 40), rgb(243, 229, 186));
        opacity: 0;
        transition: opacity .3s;
        background-position: center bottom;
        background-size: 100% 200%;
    }

    .friends-notifier-toggle-button[data-friends-notifier-button="true"]:hover {
        color: rgb(255, 244, 213);
    }

    .friends-notifier-toggle-button[data-friends-notifier-button="true"]:hover::after {
        opacity: 1;
    }

    /* Styles for resize handles */
    .resize-handle {
        position: absolute;
        width: 10px;
        height: 10px;
        background-color: rgba(0, 191, 255, 0.0); /* Transparent by default */
        border: 1px solid rgba(205, 190, 145, 0.0); /* Transparent by default */
        z-index: inherit;
        pointer-events: auto !important;
    }
    .resize-handle:hover {
        background-color: rgba(0, 191, 255, 0.5); /* Visible on hover */
        border: 1px solid rgba(205, 190, 145, 0.5); /* Visible on hover */
    }


    .handle-tl { top: -5px; left: -5px; cursor: nwse-resize; }
    .handle-tr { top: -5px; right: -5px; cursor: nesw-resize; }
    .handle-bl { bottom: -5px; left: -5px; cursor: nesw-resize; }
    .handle-br { bottom: -5px; right: -5px; cursor: nwse-resize; }
    .handle-t { top: -5px; left: 5px; right: 5px; cursor: ns-resize; height: 5px; width: auto; }
    .handle-b { bottom: -5px; left: 5px; right: 5px; cursor: ns-resize; height: 5px; width: auto; }
    .handle-l { left: -5px; top: 5px; bottom: 5px; cursor: ew-resize; width: 5px; height: auto; }
    .handle-r { right: -5px; top: 5px; bottom: 5px; cursor: ew-resize; width: 5px; height: auto; }

    /* New styles for filter settings panel */
    #friends-notifier-filter-settings {
        flex-grow: 1;
        overflow-y: auto;
        padding: 10px;
        display: none; /* Hidden by default */
        flex-direction: column;
        gap: 10px;
        background-color: rgba(40, 45, 50, 0.9);
    }
    #friends-notifier-filter-settings .filter-section {
        border: 1px solid rgba(205, 190, 145, 0.3);
        border-radius: 5px;
        padding: 10px;
    }
    #friends-notifier-filter-settings .filter-section-title {
        font-weight: bold;
        margin-bottom: 5px;
        color: rgb(243, 229, 186);
    }
    #friends-notifier-filter-settings label {
        display: block;
        margin-bottom: 3px;
        cursor: pointer;
    }
    #friends-notifier-filter-settings input[type="checkbox"] {
        margin-right: 5px;
    }
    #friends-notifier-filter-settings .filter-mode-options label,
    #friends-notifier-filter-settings .toast-position-options label, /* New style for toast position radios */
    #friends-notifier-filter-settings .sound-pack-options label {
        display: inline-block;
        margin-right: 15px;
    }

    /* Styles for search bar */
    .friend-search-input { /* Generic class for search inputs */
        width: calc(100% - 20px); /* Adjust for padding */
        padding: 8px 10px;
        margin-bottom: 10px;
        border: 1px solid rgb(205, 190, 145);
        border-radius: 4px;
        background-color: rgb(50, 55, 60);
        color: rgb(205, 190, 145);
        font-size: 12px;
        box-sizing: border-box; /* Include padding and border in the element's total width and height */
    }
    .friend-search-input::placeholder {
        color: rgba(205, 190, 145, 0.7);
    }

    #sound-volume-slider-container,
    #panel-opacity-slider-container,
    #toast-duration-slider-container { /* New style for opacity and toast duration slider container */
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 10px;
    }

    #sound-volume-slider,
    #panel-opacity-slider,
    #toast-duration-slider { /* New style for opacity and toast duration slider */
        flex-grow: 1;
        width: auto; /* Allow it to take available space */
        -webkit-appearance: none; /* Override default look */
        appearance: none;
        height: 8px;
        background: #555;
        outline: none;
        opacity: 0.7;
        transition: opacity .2s;
        border-radius: 4px;
    }

    #sound-volume-slider:hover,
    #panel-opacity-slider:hover,
    #toast-duration-slider:hover {
        opacity: 1;
    }

    #sound-volume-slider::-webkit-slider-thumb,
    #panel-opacity-slider::-webkit-slider-thumb,
    #toast-duration-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: rgb(205, 190, 145);
        cursor: pointer;
        border: 1px solid rgba(0,0,0,0.5);
    }

    #sound-volume-slider::-moz-range-thumb,
    #panel-opacity-slider::-moz-range-thumb,
    #toast-duration-slider::-moz-range-thumb {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: rgb(205, 190, 145);
        cursor: pointer;
        border: 1px solid rgba(0,0,0,0.5);
    }

    /* Styles for the stats list items */
    .stats-entry {
        display: flex;
        align-items: center;
        padding: 5px;
        border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .stats-entry:last-child {
        border-bottom: none;
    }
    .stats-entry .friend-icon {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        margin-right: 10px;
        border: 1px solid rgba(205, 190, 145, 0.5);
    }
    .stats-entry .friend-details {
        flex-grow: 1;
    }
    .stats-entry .friend-name {
        font-weight: bold;
        color: rgb(243, 229, 186);
    }
    .stats-entry .stat-line {
        font-size: 11px;
        color: #bbb;
    }

    /* Toast Container */
    #friends-notifier-toast-container {
        position: fixed;
        z-index: 2147483647; /* Max z-index to be on top */
        display: flex;
        flex-direction: column;
        padding: 10px;
        gap: 10px; /* Spacing between multiple toasts */
        pointer-events: none; /* Allows clicks to pass through the container itself */
    }

    /* Specific positions */
    #friends-notifier-toast-container.top-right {
        top: 20px;
        right: 20px;
        align-items: flex-end; /* Stack from top, align right */
    }
    #friends-notifier-toast-container.top-left {
        top: 20px;
        left: 20px;
        align-items: flex-start; /* Stack from top, align left */
    }
    #friends-notifier-toast-container.bottom-right {
        bottom: 20px;
        right: 20px;
        align-items: flex-end; /* Stack from bottom, align right */
        flex-direction: column-reverse; /* New toasts appear above old ones */
    }
    #friends-notifier-toast-container.bottom-left {
        bottom: 20px;
        left: 20px;
        align-items: flex-start; /* Stack from bottom, align left */
        flex-direction: column-reverse; /* New toasts appear above old ones */
    }

    /* Individual Toast Styles */
    .friends-notifier-toast {
        background-color: rgba(32, 35, 40, 0.95);
        border: 1.5px solid rgb(205, 190, 145);
        border-radius: 6px;
        padding: 10px 15px;
        color: rgb(243, 229, 186);
        font-family: 'Arial', sans-serif;
        font-size: 13px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        min-width: 250px;
        max-width: 350px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        pointer-events: all; /* Allow interaction with the toast itself */
        opacity: 0; /* Start hidden for animation */
        transform: translateY(20px); /* Start slightly off for animation */
        animation: fadeInSlideUp 0.3s ease-out forwards;
    }
    /* Animation for Toast Fade In and Slide Up */
    @keyframes fadeInSlideUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    .friends-notifier-toast .toast-close-btn {
        background: none;
        border: none;
        color: inherit;
        font-size: 18px;
        cursor: pointer;
        margin-left: 10px;
        opacity: 0.7;
        transition: opacity 0.2s;
        pointer-events: all; /* Ensure button is clickable */
    }
    .friends-notifier-toast .toast-close-btn:hover {
        opacity: 1;
    }

    /* Toast type specific colors */
    .friends-notifier-toast.toast-success { border-color: #66cc66; color: #66cc66; }
    .friends-notifier-toast.toast-error { border-color: #ff6666; color: #ff6666; }
    .friends-notifier-toast.toast-info { border-color: #99bbff; color: #99bbff; }

    /* Visual Cues for Log Entries */
    .log-entry .status-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-right: 5px;
        vertical-align: middle;
    }
    .log-entry.connected .status-dot, .log-entry .status-dot.online { background-color: #66cc66; }
    .log-entry.disconnected .status-dot, .log-entry .status-dot.offline { background-color: #ff6666; }
    .log-entry .status-dot.away { background-color: #ffcc00; } /* yellow for away/busy */
    .log-entry .status-dot.dnd { background-color: #cc0000; } /* darker red for dnd */
    .log-entry .status-dot.ingame { background-color: #ff9933; } /* orange for in-game */

    /* Go to Profile button in log */
    .log-entry .go-to-profile-btn {
        background-color: rgba(205, 190, 145, 0.2);
        border: 1px solid rgb(205, 190, 145);
        color: rgb(205, 190, 145);
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        cursor: pointer;
        margin-left: 10px;
        transition: background-color 0.2s, color 0.2s;
    }
    .log-entry .go-to-profile-btn:hover {
        background-color: rgba(205, 190, 145, 0.4);
        color: rgb(255, 244, 213);
    }
`;


/**
 * Converts milliseconds to a human-readable duration string.
 * @param {number} ms - Time in milliseconds.
 * @returns {string} Formatted duration string (e.g., "2h 30m 15s").
 */
function formatDuration(ms) {
    if (ms === 0) return "0s";
    if (ms < 0) return `-${formatDuration(Math.abs(ms))}`;

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    let result = [];
    if (days > 0) result.push(`${days}d`);
    if (hours % 24 > 0) result.push(`${hours % 24}h`);
    if (minutes % 60 > 0) result.push(`${minutes % 60}m`);
    if (seconds % 60 > 0 || result.length === 0) result.push(`${seconds % 60}s`); // Ensure at least seconds are shown

    return result.join(' ');
}


/**
 * Recalculates and sets the custom log panel's position to the bottom-right corner.
 * This is called on initial creation and window resize.
 */
function repositionLogPanel() {
    if (logPanelElement) {
        // Ensure panel's current dimensions are used for calculation if it has been resized
        const currentWidth = logPanelElement.offsetWidth;
        const currentHeight = logPanelElement.offsetHeight;

        logPanelPosition.top = window.innerHeight - currentHeight - PANEL_MARGIN;
        logPanelPosition.left = window.innerWidth - currentWidth - PANEL_MARGIN;

        // Apply and persist the new position
        logPanelElement.style.top = logPanelPosition.top + 'px';
        logPanelElement.style.left = logPanelPosition.left + 'px';
        DataStore.set('RN_log_panel_position', logPanelPosition);
        DataStore.set('RN_log_panel_size', { width: currentWidth, height: currentHeight }); // Also save current size
    }
}

/**
 * Recalculates and sets the stats panel's position (default top-left).
 * This is called on initial creation and window resize.
 */
function repositionStatsPanel() {
    if (statsPanelElement) {
        // Ensure panel's current dimensions are used for calculation if it has been resized
        const currentWidth = statsPanelElement.offsetWidth;
        const currentHeight = statsPanelElement.offsetHeight;

        // For stats panel, let's keep it near top-left, but adjust if it goes off screen
        statsPanelPosition.top = Math.max(PANEL_MARGIN, Math.min(statsPanelPosition.top, window.innerHeight - currentHeight - PANEL_MARGIN));
        statsPanelPosition.left = Math.max(PANEL_MARGIN, Math.min(statsPanelPosition.left, window.innerWidth - currentWidth - PANEL_MARGIN));

        // Apply and persist the new position
        statsPanelElement.style.top = statsPanelPosition.top + 'px';
        statsPanelElement.style.left = statsPanelPosition.left + 'px';
        DataStore.set('RN_stats_panel_position', statsPanelPosition);
        DataStore.set('RN_stats_panel_size', { width: currentWidth, height: currentHeight }); // Also save current size
    }
}


/**
 * Creates and injects the history panel into the game client's DOM.
 */
function createLogPanel() {
    console.log("FriendsNotifier: createLogPanel() called.");

    if (logPanelElement && document.body.contains(logPanelElement)) {
        console.log("FriendsNotifier: Log Panel already exists in DOM, re-using existing element.");
        repositionLogPanel(); // Ensure correct position on re-use
        return;
    }

    try {
        // Inject styles first (only once for all styles)
        if (!document.getElementById('friends-notifier-styles')) {
            const styleTag = document.createElement('style');
            styleTag.id = 'friends-notifier-styles';
            styleTag.textContent = panelStyles;
            document.head.appendChild(styleTag);
            console.log("FriendsNotifier: Panel styles injected.");
        }


        logPanelElement = document.createElement('div');
        logPanelElement.id = 'friends-notifier-log-panel';

        // Directly set initial visibility based on launchPanelOnStartup from filterSettings
        // This makes isLogPanelVisible reflect the actual state when the panel is created.
        if (filterSettings.launchPanelOnStartup) {
            logPanelElement.style.display = 'flex';
            logPanelElement.style.opacity = '1';
            logPanelElement.style.transform = `translateY(0%)`;
            logPanelElement.style.visibility = 'visible';
            isLogPanelVisible = true; // Update internal state
        } else {
            logPanelElement.style.opacity = '0';
            logPanelElement.style.transform = `translateY(50%)`;
            logPanelElement.style.display = 'none';
            logPanelElement.style.visibility = 'hidden';
            isLogPanelVisible = false; // Update internal state
        }

        // Set initial background opacity
        logPanelElement.style.backgroundColor = `rgba(32, 35, 40, ${filterSettings.panelOpacity})`;


        logPanelElement.innerHTML = `
            <div id="friends-notifier-panel-header">
                <span id="friends-notifier-panel-header-title">Friend Status History</span>
                <div id="friends-notifier-panel-header-buttons">
                    <button id="friends-notifier-panel-stats-btn" title="Open Friend Statistics">${statsIcon}</button>
                    <button id="friends-notifier-panel-clear-log-btn" title="Clear Log History">&#x1F5D1;</button> <!-- Trash can icon -->
                    <button id="friends-notifier-panel-settings-btn" title="Settings">&#9881;</button> <!-- Gear icon for settings -->
                    <button id="friends-notifier-panel-close" title="Close Panel">&times;</button>
                </div>
            </div>
            <div id="friends-notifier-panel-content"></div>
            <div id="friends-notifier-filter-settings"></div>
            <div class="resize-handle handle-tl"></div>
            <div class="resize-handle handle-tr"></div>
            <div class="resize-handle handle-bl"></div>
            <div class="resize-handle handle-br"></div>
            <div class="resize-handle handle-t"></div>
            <div class="resize-handle handle-b"></div>
            <div class="resize-handle handle-l"></div>
            <div class="resize-handle handle-r"></div>
        `;

        // Append to body
        document.body.appendChild(logPanelElement);
        console.log("FriendsNotifier: Log Panel element appended to document.body.");

        // Get references to header, close button, settings button, clear log button, and NEW stats button
        const panelHeader = document.getElementById('friends-notifier-panel-header');
        const closeButton = document.getElementById('friends-notifier-panel-close');
        const settingsButton = document.getElementById('friends-notifier-panel-settings-btn');
        const clearLogButton = document.getElementById('friends-notifier-panel-clear-log-btn');
        const statsButtonInLogPanel = document.getElementById('friends-notifier-panel-stats-btn'); // NEW REF

        const handleTL = logPanelElement.querySelector('.handle-tl');
        const handleTR = logPanelElement.querySelector('.handle-tr');
        const handleBL = logPanelElement.querySelector('.handle-bl');
        const handleBR = logPanelElement.querySelector('.handle-br');
        const handleT = logPanelElement.querySelector('.handle-t');
        const handleB = logPanelElement.querySelector('.handle-b');
        const handleL = logPanelElement.querySelector('.handle-l');
        const handleR = logPanelElement.querySelector('.handle-r');


        // Make the custom log panel draggable using its header
        if (panelHeader) {
            makeElementDraggable(logPanelElement, panelHeader, 'RN_log_panel');
            // Add click test for header
            panelHeader.addEventListener('click', () => console.log("FriendsNotifier: Clicked Log Panel header!"));
        } else {
            console.error("FriendsNotifier: ERROR: Log Panel header element not found for dragging.");
        }

        // Handle close button click
        if (closeButton) {
            closeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleLogPanel();
                console.log("FriendsNotifier: Clicked Log Panel close button!");
            });
        } else {
            console.error("FriendsNotifier: ERROR: Log Panel close button element not found. Close functionality might be broken.");
        }

        // Handle settings button click
        if (settingsButton) {
            settingsButton.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleSettingsPanel();
                console.log("FriendsNotifier: Clicked Log Panel settings button!");
            });
        } else {
            console.error("FriendsNotifier: ERROR: Log Panel settings button not found.");
        }

        // Handle clear log button click
        if (clearLogButton) {
            clearLogButton.addEventListener('click', (e) => {
                e.stopPropagation();
                clearLogs();
                console.log("FriendsNotifier: Clicked clear log button!");
            });
        } else {
            console.error("FriendsNotifier: ERROR: Clear log button not found.");
        }

        // Handle NEW stats button click
        if (statsButtonInLogPanel) {
            statsButtonInLogPanel.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleStatsPanel(); // Call the toggle function for the stats panel
                console.log("FriendsNotifier: Clicked Stats button in Log Panel!");
            });
        } else {
            console.error("FriendsNotifier: ERROR: Stats button in Log Panel not found.");
        }


        // Make the custom log panel resizable using its handles
        if (handleTL) { makeElementResizable(logPanelElement, handleTL, 'tl', 'RN_log_panel'); }
        if (handleTR) { makeElementResizable(logPanelElement, handleTR, 'tr', 'RN_log_panel'); }
        if (handleBL) { makeElementResizable(logPanelElement, handleBL, 'bl', 'RN_log_panel'); }
        if (handleBR) { makeElementResizable(logPanelElement, handleBR, 'br', 'RN_log_panel'); }
        if (handleT) { makeElementResizable(logPanelElement, handleT, 't', 'RN_log_panel'); }
        if (handleB) { makeElementResizable(logPanelElement, handleB, 'b', 'RN_log_panel'); }
        if (handleL) { makeElementResizable(logPanelElement, handleL, 'l', 'RN_log_panel'); }
        if (handleR) { makeElementResizable(logPanelElement, handleR, 'r', 'RN_log_panel'); }
        console.log("FriendsNotifier: Applied makeElementResizable to custom log panel.");


        repositionLogPanel(); // Initial positioning after creation
        updateLogPanelContent(); // Initial content update

        // Set initial display of content vs settings panel based on isSettingsPanelVisible state
        document.getElementById('friends-notifier-panel-content').style.display = isSettingsPanelVisible ? 'none' : 'flex';
        document.getElementById('friends-notifier-filter-settings').style.display = isSettingsPanelVisible ? 'flex' : 'none';

        // Call renderFilterSettings if settings panel is initially visible
        if (isSettingsPanelVisible) {
            renderFilterSettings();
        }
        console.log("FriendsNotifier: Log Panel creation and initial content update complete.");

    } catch (error) {
        console.error("FriendsNotifier: ERROR during createLogPanel():", error);
    }
}

/**
 * Creates and injects the new stats panel into the game client's DOM.
 */
function createStatsPanel() {
    console.log("FriendsNotifier: createStatsPanel() called.");

    if (statsPanelElement && document.body.contains(statsPanelElement)) {
        console.log("FriendsNotifier: Stats Panel already exists in DOM, re-using existing element.");
        repositionStatsPanel();
        return;
    }

    try {
        // Inject styles if not already injected
        if (!document.getElementById('friends-notifier-styles')) {
            const styleTag = document.createElement('style');
            styleTag.id = 'friends-notifier-styles';
            styleTag.textContent = panelStyles;
            document.head.appendChild(styleTag);
            console.log("FriendsNotifier: Panel styles injected during stats panel creation.");
        }

        statsPanelElement = document.createElement('div');
        statsPanelElement.id = 'friends-notifier-stats-panel';

        // Set initial visibility based on isStatsPanelVisible
        statsPanelElement.style.display = isStatsPanelVisible ? 'flex' : 'none';
        statsPanelElement.style.opacity = isStatsPanelVisible ? '1' : '0';
        statsPanelElement.style.transform = isStatsPanelVisible ? `translateY(0%)` : `translateY(50%)`;
        statsPanelElement.style.visibility = isStatsPanelVisible ? 'visible' : 'hidden';

        // Set initial background opacity
        statsPanelElement.style.backgroundColor = `rgba(32, 35, 40, ${filterSettings.panelOpacity})`;

        statsPanelElement.innerHTML = `
            <div id="friends-notifier-stats-header">
                <span id="friends-notifier-stats-header-title">Friend Statistics</span>
                <div id="friends-notifier-stats-header-buttons">
                    <button id="friends-notifier-stats-close" title="Close Panel">&times;</button>
                </div>
            </div>
            <div style="padding: 10px;">
                <input type="text" id="stats-friend-search-input" class="friend-search-input" placeholder="Search friends...">
            </div>
            <div id="friends-notifier-stats-content"></div>
            <div class="resize-handle handle-tl"></div>
            <div class="resize-handle handle-tr"></div>
            <div class="resize-handle handle-bl"></div>
            <div class="resize-handle handle-br"></div>
            <div class="resize-handle handle-t"></div>
            <div class="resize-handle handle-b"></div>
            <div class="resize-handle handle-l"></div>
            <div class="resize-handle handle-r"></div>
        `;

        document.body.appendChild(statsPanelElement);
        console.log("FriendsNotifier: Stats Panel element appended to document.body.");

        const statsHeader = document.getElementById('friends-notifier-stats-header');
        const statsCloseButton = document.getElementById('friends-notifier-stats-close');
        const statsSearchInput = document.getElementById('stats-friend-search-input');

        if (statsHeader) {
            makeElementDraggable(statsPanelElement, statsHeader, 'RN_stats_panel');
            statsHeader.addEventListener('click', () => console.log("FriendsNotifier: Clicked Stats Panel header!"));
        } else {
            console.error("FriendsNotifier: ERROR: Stats Panel header not found for dragging.");
        }

        if (statsCloseButton) {
            statsCloseButton.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleStatsPanel();
                console.log("FriendsNotifier: Clicked Stats Panel close button!");
            });
        } else {
            console.error("FriendsNotifier: ERROR: Stats Panel close button not found.");
        }

        if (statsSearchInput) {
            statsSearchInput.addEventListener('input', (e) => {
                statsPanelFriendSearchQuery = e.target.value;
                updateStatsPanelContent(); // Re-render stats with search filter
            });
        }

        // Make the stats panel resizable using its handles
        const statsHandleTL = statsPanelElement.querySelector('.handle-tl');
        const statsHandleTR = statsPanelElement.querySelector('.handle-tr');
        const statsHandleBL = statsPanelElement.querySelector('.handle-bl');
        const statsHandleBR = statsPanelElement.querySelector('.handle-br');
        const statsHandleT = statsPanelElement.querySelector('.handle-t');
        const statsHandleB = statsPanelElement.querySelector('.handle-b');
        const statsHandleL = statsPanelElement.querySelector('.handle-l');
        const statsHandleR = statsPanelElement.querySelector('.handle-r');

        if (statsHandleTL) { makeElementResizable(statsPanelElement, statsHandleTL, 'tl', 'RN_stats_panel'); }
        if (statsHandleTR) { makeElementResizable(statsPanelElement, statsHandleTR, 'tr', 'RN_stats_panel'); }
        if (statsHandleBL) { makeElementResizable(statsPanelElement, statsHandleBL, 'bl', 'RN_stats_panel'); }
        if (statsHandleBR) { makeElementResizable(statsPanelElement, statsHandleBR, 'br', 'RN_stats_panel'); }
        if (statsHandleT) { makeElementResizable(statsPanelElement, statsHandleT, 't', 'RN_stats_panel'); }
        if (statsHandleB) { makeElementResizable(statsPanelElement, statsHandleB, 'b', 'RN_stats_panel'); }
        if (statsHandleL) { makeElementResizable(statsPanelElement, statsHandleL, 'l', 'RN_stats_panel'); }
        if (statsHandleR) { makeElementResizable(statsPanelElement, statsHandleR, 'r', 'RN_stats_panel'); }
        console.log("FriendsNotifier: Applied makeElementResizable to stats panel.");

        repositionStatsPanel(); // Initial positioning
        updateStatsPanelContent(); // Initial content update
        console.log("FriendsNotifier: Stats Panel creation and initial content update complete.");

    } catch (error) {
        console.error("FriendsNotifier: ERROR during createStatsPanel():", error);
    }
}


/**
 * Toggles the visibility of the history panel.
 */
function toggleLogPanel() {
    isLogPanelVisible = !isLogPanelVisible;
    DataStore.set('RN_log_panel_visible', isLogPanelVisible);

    if (logPanelElement) {
        if (isLogPanelVisible) {
            logPanelElement.style.display = 'flex';
            logPanelElement.style.opacity = 1;
            logPanelElement.style.transform = `translateY(0%)`;
            logPanelElement.style.visibility = 'visible';
            repositionLogPanel();
        } else {
            logPanelElement.style.opacity = 0;
            logPanelElement.style.transform = `translateY(50%)`;
            logPanelElement.style.display = 'none';
            logPanelElement.style.visibility = 'hidden';
        }
    } else {
        console.error("FriendsNotifier: Cannot toggle log panel visibility: logPanelElement is not defined.");
    }
    CustomToast.info(`Friend History Panel ${isLogPanelVisible ? 'shown' : 'hidden'}`);
}

/**
 * Toggles the visibility of the stats panel.
 */
function toggleStatsPanel() {
    isStatsPanelVisible = !isStatsPanelVisible;
    DataStore.set('RN_stats_panel_visible', isStatsPanelVisible);

    if (statsPanelElement) {
        if (isStatsPanelVisible) {
            statsPanelElement.style.display = 'flex';
            statsPanelElement.style.opacity = 1;
            statsPanelElement.style.transform = `translateY(0%)`;
            statsPanelElement.style.visibility = 'visible';
            repositionStatsPanel();
            updateStatsPanelContent(); // Update content when shown
        } else {
            statsPanelElement.style.opacity = 0;
            statsPanelElement.style.transform = `translateY(50%)`;
            statsPanelElement.style.display = 'none';
            statsPanelElement.style.visibility = 'hidden';
        }
    } else {
        console.error("FriendsNotifier: Cannot toggle stats panel visibility: statsPanelElement is not defined.");
    }
    CustomToast.info(`Friend Statistics Panel ${isStatsPanelVisible ? 'shown' : 'hidden'}`);
}


/**
 * Toggles the visibility of the settings panel within the main log panel.
 */
function toggleSettingsPanel() {
    isSettingsPanelVisible = !isSettingsPanelVisible;
    const contentPanel = document.getElementById('friends-notifier-panel-content');
    const settingsPanel = document.getElementById('friends-notifier-filter-settings');

    if (contentPanel && settingsPanel) {
        if (isSettingsPanelVisible) {
            contentPanel.style.display = 'none';
            settingsPanel.style.display = 'flex';
            renderFilterSettings(); // Populate settings when visible
        } else {
            contentPanel.style.display = 'flex';
            settingsPanel.style.display = 'none';
        }
    } else {
        console.error("FriendsNotifier: Could not find content or settings panel elements.");
    }
}

/**
 * Renders the filter settings UI within the settings panel.
 * Populates friend and group checkboxes based on current filterSettings.
 */
async function renderFilterSettings() {
    if (!logPanelElement) {
        console.warn("FriendsNotifier: Cannot render settings, logPanelElement is null.");
        return;
    }

    const settingsPanel = document.getElementById('friends-notifier-filter-settings');
    if (!settingsPanel) {
        console.error("FriendsNotifier: Settings panel div not found.");
        return;
    }

    // Preserve the current search query when re-rendering
    const currentSearchInput = settingsPanel.querySelector('#friend-search-input');
    if (currentSearchInput) {
        friendSearchQuery = currentSearchInput.value;
    }

    settingsPanel.innerHTML = `
        <div class="filter-section">
            <div class="filter-section-title">General Settings</div>
            <label>
                <input type="checkbox" data-setting="isGloballyMuted" ${filterSettings.isGloballyMuted ? 'checked' : ''}> Global Mute Notifications (Toasts & Sounds)
            </label>
            <div id="panel-opacity-slider-container">
                <span>Panel Opacity:</span>
                <input type="range" id="panel-opacity-slider" min="0.1" max="1" step="0.05" value="${filterSettings.panelOpacity}">
            </div>
            <label>
                <input type="checkbox" data-setting="displayEmotesInLog" ${filterSettings.displayEmotesInLog ? 'checked' : ''}> Display Emotes in Log
            </label>
            <label>
                <input type="checkbox" data-setting="launchPanelOnStartup" ${filterSettings.launchPanelOnStartup ? 'checked' : ''}> Launch History Panel on Startup
            </label>
        </div>
        <div class="filter-section">
            <div class="filter-section-title">Toast Notification Settings</div>
            <div class="toast-position-options">
                <div class="filter-section-title">Position</div>
                <label>
                    <input type="radio" name="toastPosition" value="top-right" ${filterSettings.toastPosition === 'top-right' ? 'checked' : ''}> Top Right
                </label>
                <label>
                    <input type="radio" name="toastPosition" value="top-left" ${filterSettings.toastPosition === 'top-left' ? 'checked' : ''}> Top Left
                </label>
                <label>
                    <input type="radio" name="toastPosition" value="bottom-right" ${filterSettings.toastPosition === 'bottom-right' ? 'checked' : ''}> Bottom Right
                </label>
                <label>
                    <input type="radio" name="toastPosition" value="bottom-left" ${filterSettings.toastPosition === 'bottom-left' ? 'checked' : ''}> Bottom Left
                </label>
            </div>
            <div id="toast-duration-slider-container">
                <span>Display Duration (seconds):</span>
                <input type="range" id="toast-duration-slider" min="1" max="10" step="1" value="${filterSettings.toastDuration}">
            </div>
        </div>
        <div class="filter-section">
            <div class="filter-section-title">Filter Mode</div>
            <div class="filter-mode-options">
                <label>
                    <input type="radio" name="filterMode" value="whitelist" ${filterSettings.mode === 'whitelist' ? 'checked' : ''}>
                    Whitelist (Only notify for selected)
                </label>
                <label>
                    <input type="radio" name="filterMode" value="blacklist" ${filterSettings.mode === 'blacklist' ? 'checked' : ''}>
                    Blacklist (Notify for all except selected)
                </label>
            </div>
        </div>
        <div class="filter-section">
            <div class="filter-section-title">Visual & Log Notifications</div>
            <label>
                <input type="checkbox" data-setting="notifyOnConnect" ${filterSettings.notifyOnConnect ? 'checked' : ''}> Friend Connected
            </label>
            <label>
                <input type="checkbox" data-setting="notifyOnDisconnect" ${filterSettings.notifyOnDisconnect ? 'checked' : ''}> Friend Disconnected
            </label>
            <label>
                <input type="checkbox" data-setting="notifyOnStatusChange" ${filterSettings.notifyOnStatusChange ? 'checked' : ''}> Friend Status Changed
            </label>
            <label>
                <input type="checkbox" data-setting="notifyOnFriendRemoved" ${filterSettings.notifyOnFriendRemoved ? 'checked' : ''}> Friend Removed
            </label>
            <label>
                <input type="checkbox" data-setting="notifyOnFriendAdded" ${filterSettings.notifyOnFriendAdded ? 'checked' : ''}> Friend Added
            </label>
            <label>
                <input type="checkbox" data-setting="notifyOnFriendRequestReceived" ${filterSettings.notifyOnFriendRequestReceived ? 'checked' : ''}> Friend Request Received
            </label>
            <label>
                <input type="checkbox" data-setting="notifyOnFriendRequestDeleted" ${filterSettings.notifyOnFriendRequestDeleted ? 'checked' : ''}> Friend Request Deleted
            </label>
            <label>
                <input type="checkbox" data-setting="notifyOnMyStatusChange" ${filterSettings.notifyOnMyStatusChange ? 'checked' : ''}> My Status Changed
            </label>
        </div>
        <div class="filter-section">
            <div class="filter-section-title">Sound Notifications</div>
            <label>
                <input type="checkbox" data-setting="soundOnConnect" ${filterSettings.soundOnConnect ? 'checked' : ''}> Friend Connected Sound
            </label>
            <label>
                <input type="checkbox" data-setting="soundOnDisconnect" ${filterSettings.soundOnDisconnect ? 'checked' : ''}> Friend Disconnected Sound
            </label>
            <label>
                <input type="checkbox" data-setting="soundOnStatusChange" ${filterSettings.soundOnStatusChange ? 'checked' : ''}> Friend Status Changed Sound
            </label>
            <label>
                <input type="checkbox" data-setting="soundOnFriendRemoved" ${filterSettings.soundOnFriendRemoved ? 'checked' : ''}> Friend Removed Sound
            </label>
            <label>
                <input type="checkbox" data-setting="soundOnFriendAdded" ${filterSettings.soundOnFriendAdded ? 'checked' : ''}> Friend Added Sound
            </label>
            <label>
                <input type="checkbox" data-setting="soundOnFriendRequestReceived" ${filterSettings.soundOnFriendRequestReceived ? 'checked' : ''}> Friend Request Received Sound
            </label>
            <label>
                <input type="checkbox" data-setting="soundOnFriendRequestDeleted" ${filterSettings.soundOnFriendRequestDeleted ? 'checked' : ''}> Friend Request Deleted Sound
            </label>
            <div id="sound-volume-slider-container">
                <span>Volume:</span>
                <input type="range" id="sound-volume-slider" min="0" max="1" step="0.05" value="${filterSettings.soundVolume}">
            </div>
            <div class="sound-pack-options">
                <div class="filter-section-title">Sound Pack</div>
                <label><input type="radio" name="soundPack" value="default" ${filterSettings.selectedSoundPack === 'default' ? 'checked' : ''}> Default Beeps</label>
                <label><input type="radio" name="soundPack" value="chime" ${filterSettings.selectedSoundPack === 'chime' ? 'checked' : ''}> Chime Sounds</label>
                <label><input type="radio" name="soundPack" value="click" ${filterSettings.selectedSoundPack === 'click' ? 'checked' : ''}> Click Sounds</label>
            </div>
        </div>
        <div class="filter-section">
            <div class="filter-section-title">Friends</div>
            <input type="text" id="friend-search-input" class="friend-search-input" placeholder="Search friends by name or Riot ID..." value="${friendSearchQuery}">
            <div id="friends-filter-list"></div>
        </div>
        <div class="filter-section">
            <div class="filter-section-title">Groups</div>
            <div id="groups-filter-list"></div>
        </div>
    `;

    // Add change listener for filter mode radio buttons
    settingsPanel.querySelectorAll('input[name="filterMode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            filterSettings.mode = e.target.value;
            DataStore.set('RN_filter_settings', filterSettings);
            console.log(`FriendsNotifier: Filter mode set to: ${filterSettings.mode}`);
            updateLogPanelContent(); // Re-render logs with new filter mode
        });
    });

    // Add change listener for sound pack radio buttons
    settingsPanel.querySelectorAll('input[name="soundPack"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            filterSettings.selectedSoundPack = e.target.value;
            DataStore.set('RN_filter_settings', filterSettings);
            console.log(`FriendsNotifier: Sound pack set to: ${filterSettings.selectedSoundPack}`);
        });
    });

    // Add change listener for toast position radio buttons
    settingsPanel.querySelectorAll('input[name="toastPosition"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            filterSettings.toastPosition = e.target.value;
            DataStore.set('RN_filter_settings', filterSettings);
            CustomToast.reposition(); // Update toast container position
            console.log(`FriendsNotifier: Toast position set to: ${filterSettings.toastPosition}`);
        });
    });

    // Add input event listener for the volume slider
    const soundVolumeSlider = document.getElementById('sound-volume-slider');
    if (soundVolumeSlider) {
        soundVolumeSlider.addEventListener('input', (e) => {
            filterSettings.soundVolume = parseFloat(e.target.value);
            if (masterGainNode) {
                // Ensure 'checked' refers to the global mute checkbox state
                const isGloballyMutedCheckbox = document.querySelector('input[data-setting="isGloballyMuted"]');
                const isMuted = isGloballyMutedCheckbox ? isGloballyMutedCheckbox.checked : filterSettings.isGloballyMuted;
                masterGainNode.gain.setValueAtTime(isMuted ? 0 : filterSettings.soundVolume, audioContext.currentTime);
            }
            DataStore.set('RN_filter_settings', filterSettings); // Persist volume setting
            console.log(`FriendsNotifier: Sound volume set to: ${filterSettings.soundVolume}`);
        });
    }

    // Add input event listener for the panel opacity slider
    const panelOpacitySlider = document.getElementById('panel-opacity-slider');
    if (panelOpacitySlider) {
        panelOpacitySlider.addEventListener('input', (e) => {
            filterSettings.panelOpacity = parseFloat(e.target.value);
            if (logPanelElement) {
                const baseColor = 'rgba(32, 35, 40, ';
                logPanelElement.style.backgroundColor = `${baseColor}${filterSettings.panelOpacity})`;
            }
            if (statsPanelElement) { // Apply to stats panel too
                const baseColor = 'rgba(32, 35, 40, ';
                statsPanelElement.style.backgroundColor = `${baseColor}${filterSettings.panelOpacity})`;
            }
            DataStore.set('RN_filter_settings', filterSettings); // Persist opacity setting
            console.log(`FriendsNotifier: Panel opacity set to: ${filterSettings.panelOpacity}`);
        });
    }

    // Add input event listener for the toast duration slider
    const toastDurationSlider = document.getElementById('toast-duration-slider');
    if (toastDurationSlider) {
        toastDurationSlider.addEventListener('input', (e) => {
            filterSettings.toastDuration = parseInt(e.target.value, 10);
            DataStore.set('RN_filter_settings', filterSettings); // Persist duration setting
            console.log(`FriendsNotifier: Toast duration set to: ${filterSettings.toastDuration} seconds`);
        });
    }


    const friendsFilterList = document.getElementById('friends-filter-list');
    const groupsFilterList = document.getElementById('groups-filter-list');
    const friendSearchInput = settingsPanel.querySelector('#friend-search-input');

    // Populate Friends checkboxes
    if (!friends || friends.length === 0) {
        friendsFilterList.innerHTML = '<p>No friends found.</p>';
    } else {
        const lowerCaseQuery = friendSearchInput.value.toLowerCase();
        const filteredFriends = friends.filter(friend => {
            const fullName = `${friend.gameName}#${friend.gameTag}`.toLowerCase();
            const displayName = (friend.name || '').toLowerCase(); // Use an empty string if name is null
            return fullName.includes(lowerCaseQuery) || displayName.includes(lowerCaseQuery);
        }).sort((a, b) => a.name.localeCompare(b.name));

        if (filteredFriends.length === 0) {
            friendsFilterList.innerHTML = '<p>No friends match your search.</p>';
        } else {
            filteredFriends.forEach(friend => {
                // Ensure filterSettings.selectedFriends has a default for new friends
                if (filterSettings.selectedFriends[friend.id] === undefined) {
                    filterSettings.selectedFriends[friend.id] = false;
                }
                const isChecked = filterSettings.selectedFriends[friend.id];
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" data-id="${friend.id}" data-type="friend" ${isChecked ? 'checked' : ''}>${friend.name} (${friend.gameName}#${friend.gameTag})`;
                friendsFilterList.appendChild(label);
            });
        }
    }

    // Add input event listener for the search bar
    if (friendSearchInput) {
        friendSearchInput.addEventListener('input', (e) => {
            friendSearchQuery = e.target.value;
            renderFriendsListOnly(); // Only re-render the friends list part
        });
    }

    // Populate Groups checkboxes
    if (!friendsGroups || friendsGroups.length === 0) {
        groupsFilterList.innerHTML = '<p>No groups found.</p>';
    } else {
        // Sort groups alphabetically for better UX
        friendsGroups.sort((a, b) => a.name.localeCompare(b.name)).forEach(group => {
             // Ensure filterSettings.selectedGroups has a default for new groups
            if (filterSettings.selectedGroups[group.name] === undefined) {
                filterSettings.selectedGroups[group.name] = false;
            }
            const isChecked = filterSettings.selectedGroups[group.name];
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" data-name="${group.name}" data-type="group" ${isChecked ? 'checked' : ''}>${group.name}`;
            groupsFilterList.appendChild(label);
        });
    }
    // Persist defaults for newly added friends/groups
    DataStore.set('RN_filter_settings', filterSettings);

    // Attach change listeners for all checkboxes (friends, groups, notification types, sound types)
    attachCheckboxListeners(settingsPanel);

    console.log("FriendsNotifier: Filter settings rendered.");
}

/**
 * Renders only the friends list section within the settings panel, applying the current search query.
 * This is called by the search input's event listener to update the friend list without re-rendering the entire settings panel.
 */
function renderFriendsListOnly() {
    const friendsFilterList = document.getElementById('friends-filter-list');
    if (!friendsFilterList) {
        console.error("FriendsNotifier: Friends filter list div not found for partial re-render.");
        return;
    }

    friendsFilterList.innerHTML = ''; // Clear current list

    if (!friends || friends.length === 0) {
        friendsFilterList.innerHTML = '<p>No friends found.</p>';
        return;
    }

    const lowerCaseQuery = friendSearchQuery.toLowerCase();
    const filteredFriends = friends.filter(friend => {
        const fullName = `${friend.gameName}#${friend.gameTag}`.toLowerCase();
        const displayName = (friend.name || '').toLowerCase(); // Use an empty string if name is null
        return fullName.includes(lowerCaseQuery) || displayName.includes(lowerCaseQuery);
    }).sort((a, b) => a.name.localeCompare(b.name));

    if (filteredFriends.length === 0) {
        friendsFilterList.innerHTML = '<p>No friends match your search.</p>';
    } else {
        filteredFriends.forEach(friend => {
            // Retrieve checked state from the persistent filterSettings
            const isChecked = filterSettings.selectedFriends[friend.id] || false;
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" data-id="${friend.id}" data-type="friend" ${isChecked ? 'checked' : ''}>${friend.name} (${friend.gameName}#${friend.gameTag})`;
            friendsFilterList.appendChild(label);
        });
    }

    // Reattach listeners specifically for the newly rendered friend checkboxes
    attachCheckboxListeners(friendsFilterList);
    console.log("FriendsNotifier: Friends list re-rendered with search filter.");
}

/**
 * Attaches change listeners to all checkboxes within a given parent element.
 * This helper function prevents duplicate listeners and ensures new elements get them.
 * @param {HTMLElement} parentElement - The parent element containing the checkboxes.
 */
function attachCheckboxListeners(parentElement) {
    // Attach listener for friend and group checkboxes
    parentElement.querySelectorAll('input[type="checkbox"][data-id], input[type="checkbox"][data-name]').forEach(checkbox => {
        checkbox.removeEventListener('change', handleCheckboxChange); // Prevent duplicate listeners
        checkbox.addEventListener('change', handleCheckboxChange);
    });
    // Attach listener for notification type and sound type checkboxes
    parentElement.querySelectorAll('input[type="checkbox"][data-setting]').forEach(checkbox => {
        checkbox.removeEventListener('change', handleNotificationSettingChange); // Prevent duplicate listeners
        checkbox.addEventListener('change', handleNotificationSettingChange);
    });
}

/**
 * Handles the change event for filter checkboxes (friends and groups).
 * @param {Event} e - The change event object.
 */
function handleCheckboxChange(e) {
    const id = e.target.dataset.id; // For friend IDs
    const name = e.target.dataset.name; // For group names
    const type = e.target.dataset.type;
    const checked = e.target.checked;

    if (type === 'friend') {
        filterSettings.selectedFriends[id] = checked;
        console.log(`FriendsNotifier: Friend '${id}' filter status: ${checked}`);
    } else if (type === 'group') {
        filterSettings.selectedGroups[name] = checked;
        console.log(`FriendsNotifier: Group '${name}' filter status: ${checked}`);
    }
    DataStore.set('RN_filter_settings', filterSettings);
    updateLogPanelContent(); // Re-render logs with new filter
}

/**
 * Handles the change event for notification type and sound type checkboxes.
 * @param {Event} e - The change event object.
 */
function handleNotificationSettingChange(e) {
    const settingName = e.target.dataset.setting;
    const checked = e.target.checked;

    if (filterSettings.hasOwnProperty(settingName)) {
        filterSettings[settingName] = checked;
        DataStore.set('RN_filter_settings', filterSettings); // Save updated filterSettings object
        console.log(`FriendsNotifier: Notification setting '${settingName}' status: ${checked}`);

        // If the global mute setting changes, update master gain node accordingly
        if (settingName === 'isGloballyMuted' && masterGainNode) {
            masterGainNode.gain.setValueAtTime(checked ? 0 : filterSettings.soundVolume, audioContext.currentTime);
        }

        updateLogPanelContent(); // Re-render logs with new notification type filter
    }
}

/**
 * Clears all log entries from the history panel and the logs array.
 */
function clearLogs() {
    logs.length = 0; // Clear the array
    updateLogPanelContent(); // Update the displayed content
    CustomToast.info("Friend log history cleared.");
}

// --- CUSTOM TOAST NOTIFICATION SYSTEM ---
const CustomToast = {
    init() {
        if (!toastContainerElement) {
            toastContainerElement = document.createElement('div');
            toastContainerElement.id = 'friends-notifier-toast-container';
            document.body.appendChild(toastContainerElement);
            // Add global style for the toast container if it hasn't been added by panelStyles
            if (!document.getElementById('friends-notifier-styles')) {
                const styleTag = document.createElement('style');
                styleTag.id = 'friends-notifier-styles';
                styleTag.textContent = panelStyles;
                document.head.appendChild(styleTag);
            }
        }
        // Ensure the correct position class is applied on init/reposition
        this.reposition();
    },
    show(message, type = 'info') {
        // Respect global mute for toasts
        if (filterSettings.isGloballyMuted) {
            console.log(`FriendsNotifier: Toast muted for: ${message}`);
            return;
        }

        if (!toastContainerElement) {
            console.error("FriendsNotifier: Toast container not initialized. Cannot show toast.");
            return;
        }

        const toast = document.createElement('div');
        toast.className = `friends-notifier-toast toast-${type}`;
        toast.innerHTML = `<span>${message}</span>`;

        // Add a close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.className = 'toast-close-btn';
        closeBtn.onclick = (e) => {
            e.stopPropagation(); // Prevent event from bubbling up
            toast.remove();
        };
        toast.appendChild(closeBtn);

        toastContainerElement.appendChild(toast);

        // Auto-remove after configured duration
        setTimeout(() => {
            if (toast.parentNode === toastContainerElement) { // Check if it's still in DOM before removing
                toast.remove();
            }
        }, filterSettings.toastDuration * 1000); // Convert seconds to milliseconds
    },
    success(message) { this.show(message, 'success'); },
    error(message) { this.show(message, 'error'); },
    info(message) { this.show(message, 'info'); },

    reposition() {
        if (!toastContainerElement) return;
        // Remove all existing position classes and re-add the current one
        toastContainerElement.className = 'friends-notifier-toast-container'; // Reset to base class
        toastContainerElement.classList.add(filterSettings.toastPosition);
        console.log(`FriendsNotifier: Toast container repositioned to: ${filterSettings.toastPosition}`);
    }
};

// --- END CUSTOM TOAST NOTIFICATION SYSTEM ---


// --- NEW SOUND PRESETS AND MODIFIED PLAYBEEP ---
const soundPresets = {
    'default': {
        connect: { freq: 880, dur: 0.1, vol: 0.5, type: 'sine' },
        disconnect: { freq: 220, dur: 0.1, vol: 0.5, type: 'sine' },
        statusChange: { freq: 440, dur: 0.05, vol: 0.3, type: 'sine' },
        info: { freq: 660, dur: 0.03, vol: 0.2, type: 'sine' }
    },
    'chime': {
        connect: { freq: 1000, dur: 0.12, vol: 0.6, type: 'triangle' }, // Higher, brighter
        disconnect: { freq: 300, dur: 0.12, vol: 0.6, type: 'sawtooth' }, // Lower, buzzing
        statusChange: { freq: 700, dur: 0.08, vol: 0.4, type: 'square' },
        info: { freq: 950, dur: 0.05, vol: 0.3, type: 'sine' }
    },
    'click': {
        connect: { freq: 1500, dur: 0.02, vol: 0.4, type: 'square' }, // Sharp click
        disconnect: { freq: 100, dur: 0.02, vol: 0.4, type: 'square' }, // Low click
        statusChange: { freq: 800, dur: 0.01, vol: 0.2, type: 'sine' },
        info: { freq: 1200, dur: 0.01, vol: 0.1, type: 'sine' }
    }
};

/**
 * Determines if a log entry should be displayed in the history panel and trigger a toast.
 * This function considers both global mute, event type, and friend/group filters.
 * @param {object} log - The log entry object (or friendData object for live notifications).
 * @returns {boolean} True if the log/toast should be displayed, false otherwise.
 */
function shouldNotifyAndLog(log) {
    const currentFilterSettings = DataStore.get('RN_filter_settings', filterSettings);

    // If globally muted, no toast or log entry should be displayed (unless it's the clear log itself)
    if (currentFilterSettings.isGloballyMuted) {
        return false;
    }

    const { notifyOnConnect, notifyOnDisconnect, notifyOnStatusChange,
            notifyOnFriendRemoved, notifyOnFriendAdded,
            notifyOnFriendRequestReceived, notifyOnFriendRequestDeleted,
            notifyOnMyStatusChange } = currentFilterSettings;

    // First, check if this specific type of notification is enabled via its checkbox
    let typeNotificationEnabled = true;
    switch (log.type) {
        case 'Connected': typeNotificationEnabled = notifyOnConnect; break;
        case 'Disconnected': typeNotificationEnabled = notifyOnDisconnect; break;
        case 'Friend Status Changed': typeNotificationEnabled = notifyOnStatusChange; break;
        case 'Friend Removed': typeNotificationEnabled = notifyOnFriendRemoved; break;
        case 'Friend Added': typeNotificationEnabled = notifyOnFriendAdded; break;
        case 'Friend Request Received': typeNotificationEnabled = notifyOnFriendRequestReceived; break;
        case 'Friend Request Deleted': typeNotificationEnabled = notifyOnFriendRequestDeleted; break;
        case 'My Status Changed': typeNotificationEnabled = notifyOnMyStatusChange; break;
        default: typeNotificationEnabled = true; break; // Default to true for any unknown log types
    }

    if (!typeNotificationEnabled) {
        return false; // This type of notification is disabled for toast/log display
    }

    // My Status Changed and Friend Request logs are special cases, they bypass friend/group filters
    if (log.type === 'My Status Changed' || log.type === 'Friend Request Received' || log.type === 'Friend Request Deleted') {
        return true; // Already passed type filter, no friend/group filter needed
    }

    // Now apply friend/group filters for friend-related events
    const { mode, selectedFriends, selectedGroups } = currentFilterSettings;
    const friendId = log.id || log.summonerId;
    const friend = friends.find(f => f.id === friendId || f.summonerId === friendId);

    // If friend data is not found (e.g., friend removed), and it's not a 'Friend Removed' type, don't display
    if (!friend && log.type !== 'Friend Removed') {
        return false;
    }

    const hasSelectedFriends = Object.values(selectedFriends).some(val => val);
    const hasSelectedGroups = Object.values(selectedGroups).some(val => val);

    if (!hasSelectedFriends && !hasSelectedGroups) {
        return mode === 'blacklist'; // If no specific friends/groups selected, respect global mode
    }

    let isFriendRelevant = selectedFriends[friendId] || false; // Is friend explicitly selected?

    if (friend && friend.groupId) {
        const group = friendsGroups.find(g => g.id === friend.groupId);
        if (group && selectedGroups[group.name]) {
            isFriendRelevant = true;
        }
    }

    return mode === 'whitelist' ? isFriendRelevant : !isFriendRelevant;
}

/**
 * Determines if a sound should be played for a given log entry.
 * This function considers both global mute, sound type and friend/group filters.
 * @param {object} log - The log entry object (or friendData object for live notifications).
 * @returns {boolean} True if a sound should be played, false otherwise.
 */
function shouldPlaySound(log) {
    const currentFilterSettings = DataStore.get('RN_filter_settings', filterSettings);

    // If globally muted, no sound should be played
    if (currentFilterSettings.isGloballyMuted) {
        return false;
    }

    const { soundOnConnect, soundOnDisconnect, soundOnStatusChange,
            soundOnFriendRemoved, soundOnFriendAdded,
            soundOnFriendRequestReceived, soundOnFriendRequestDeleted,
            soundOnMyStatusChange } = currentFilterSettings;

    // First, check if this specific type of sound is enabled via its checkbox
    let typeSoundEnabled = true;
    switch (log.type) {
        case 'Connected': typeSoundEnabled = soundOnConnect; break;
        case 'Disconnected': typeSoundEnabled = soundOnDisconnect; break;
        case 'Friend Status Changed': typeSoundEnabled = soundOnStatusChange; break;
        case 'Friend Removed': typeSoundEnabled = soundOnFriendRemoved; break;
        case 'Friend Added': typeSoundEnabled = soundOnFriendAdded; break;
        case 'Friend Request Received': typeSoundEnabled = soundOnFriendRequestReceived; break;
        case 'Friend Request Deleted': typeSoundEnabled = soundOnFriendRequestDeleted; break;
        case 'My Status Changed': typeSoundEnabled = soundOnMyStatusChange; break;
        default: typeSoundEnabled = false; break; // Default to false for unknown types for sound
    }

    if (!typeSoundEnabled) {
        return false; // This type of sound is disabled
    }

    // My Status Changed and Friend Request logs are special cases, they bypass friend/group filters for sound
    if (log.type === 'My Status Changed' || log.type === 'Friend Request Received' || log.type === 'Friend Request Deleted') {
        return true; // Already passed sound type filter, no friend/group filter needed
    }

    // Now apply friend/group filters for friend-related events
    const { mode, selectedFriends, selectedGroups } = currentFilterSettings;
    const friendId = log.id || log.summonerId;
    const friend = friends.find(f => f.id === friendId || f.summonerId === friendId);

    if (!friend && log.type !== 'Friend Removed') {
        return false;
    }

    const hasSelectedFriends = Object.values(selectedFriends).some(val => val);
    const hasSelectedGroups = Object.values(selectedGroups).some(val => val);

    if (!hasSelectedFriends && !hasSelectedGroups) {
        return mode === 'blacklist';
    }

    let isFriendRelevant = selectedFriends[friendId] || false;

    if (friend && friend.groupId) {
        const group = friendsGroups.find(g => g.id === friend.groupId);
        if (group && selectedGroups[group.name]) {
            isFriendRelevant = true;
        }
    }

    return mode === 'whitelist' ? isFriendRelevant : !isFriendRelevant;
}

// --- NEW EMOTE MAPPING ---
const emoteMap = {
    ':pog:': '&#127881;', // Party Popper emoji
    ':heart:': '&#x2764;&#fe0f;', // Red Heart emoji
    ':thumbsup:': '&#x1F44D;', // Thumbs Up emoji
    ':gg:': '&#x1F44B;', // Waving hand emoji (for good game)
    ':facepalm:': '&#x1F926;', // Facepalm emoji
    ':lol:': '&#x1F606;', // Laughing emoji
    // Using placeholder images for "custom" emotes for demonstration
    ':kappa:': '<img class="emote" src="https://placehold.co/16x16/333/EEE?text=K" alt="Kappa">',
    ':gaben:': '<img class="emote" src="https://placehold.co/16x16/333/EEE?text=G" alt="Gaben">'
};


/**
 * Updates the content of the history panel with the latest logs, applying filters.
 * Now includes visual cues for status and "Go to Profile" buttons.
 */
function updateLogPanelContent() {
    if (!logPanelElement) {
        console.warn("FriendsNotifier: Cannot update log panel content, logPanelElement is null.");
        return;
    }

    const contentDiv = document.getElementById('friends-notifier-panel-content');
    if (!contentDiv) {
        console.error("FriendsNotifier: Log Panel content div not found.");
        return;
    }

    contentDiv.innerHTML = '';

    logs.forEach(log => {
        if (shouldNotifyAndLog(log)) { // Apply the unified filter for display
            const entryDiv = document.createElement('div');
            entryDiv.className = 'log-entry';

            let typeClass = '';
            let message = '';
            const timestamp = new Date(log.time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            // --- ENHANCED FRIEND STATUS MESSAGES ---
            let friendDetails = `${log.name} (${log.riotId}#${log.riotTag})`;
            if (log.productName && log.productName !== 'League of Legends' && log.productName !== 'Riot Client') {
                friendDetails += ` [${log.productName}]`;
            }
            if (log.gameMode) {
                friendDetails += ` (${log.gameMode})`;
            }
            // --- END ENHANCED FRIEND STATUS MESSAGES ---

            // --- VISUAL CUES FOR STATUS CHANGES ---
            let statusDotClass = '';
            let showProfileButton = false; // Flag to control profile button visibility

            switch (log.type) {
                case 'Connected':
                    typeClass = 'connected';
                    message = `${friendDetails} has connected!`;
                    statusDotClass = 'online';
                    showProfileButton = true;
                    break;
                case 'Disconnected':
                    typeClass = 'disconnected';
                    message = `${friendDetails} has disconnected!`;
                    statusDotClass = 'offline';
                    showProfileButton = true;
                    break;
                case 'Friend Status Changed':
                    typeClass = 'status-change';
                    message = `${friendDetails} status changed from ${log.oldAvailability} to ${log.newAvailability}`;
                    statusDotClass = log.newAvailability === 'chat' ? 'online' :
                                     log.newAvailability === 'offline' ? 'offline' :
                                     log.newAvailability === 'away' ? 'away' :
                                     log.newAvailability === 'dnd' ? 'dnd' :
                                     log.newAvailability === 'ingame' ? 'ingame' : '';
                    showProfileButton = true;
                    break;
                case 'My Status Changed':
                    typeClass = 'my-status';
                    message = `Your status changed from ${log.oldAvailability} to ${log.newAvailability}`;
                    // No profile button for "My Status Changed"
                    break;
                case 'Friend Removed':
                    typeClass = 'friend-removed';
                    message = `${friendDetails} removed you.`;
                    statusDotClass = 'offline'; // Assume offline for removed friend
                    // No profile button for "Friend Removed" for privacy/availability reasons
                    break;
                case 'Friend Added':
                    typeClass = 'friend-added';
                    message = `${friendDetails} accepted your friend request.`;
                    statusDotClass = 'online'; // Assume online when added
                    showProfileButton = true;
                    break;
                case 'Friend Request Received':
                    typeClass = 'friend-request-received';
                    message = `${friendDetails} sent you a friend request.`;
                    // No status dot or profile button for friend requests
                    break;
                case 'Friend Request Deleted':
                    typeClass = 'friend-request-deleted';
                    message = `${friendDetails} deleted their friend request.`;
                    // No status dot or profile button for deleted requests
                    break;
                default:
                    message = JSON.stringify(log);
                    break;
            }

            // --- CUSTOM EMOTE/STICKER PACK LOADER (IN-LOG DISPLAY) ---
            if (filterSettings.displayEmotesInLog) {
                for (const emote in emoteMap) {
                    const regex = new RegExp(emote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                    message = message.replace(regex, emoteMap[emote]);
                }
            }
            // --- END CUSTOM EMOTE/STICKER PACK LOADER ---

            entryDiv.classList.add(typeClass);

            let logContent = `<span class="timestamp">[${timestamp}]</span> `;
            if (statusDotClass) {
                logContent += `<span class="status-dot ${statusDotClass}"></span>`;
            }
            logContent += `<span class="type">${log.type}:</span> ${message}`;

            // --- "GO TO PROFILE" BUTTON ---
            if (showProfileButton && log.id) { // Only show for entries related to actual friends with an ID
                const profileButton = document.createElement('button');
                profileButton.className = 'go-to-profile-btn';
                profileButton.textContent = 'Profile';
                profileButton.title = `View ${log.name}'s profile`;
                profileButton.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent click from interfering with panel dragging etc.
                    // Assuming context.rcp is available globally from PenguLoader's init
                    if (window.context && window.context.rcp && typeof window.context.rcp.navigate === 'function') {
                        // The exact path may vary; '/profile' is a common guess for LCU profiles.
                        // summonerId is typically the `id` field from the friend object.
                        // You might need to verify the exact navigation route for a friend's profile.
                        window.context.rcp.navigate('/profile', { summonerId: log.id, tab: 'overview' });
                        console.log(`FriendsNotifier: Attempting to navigate to profile for ${log.name} (ID: ${log.id})`);
                    } else {
                        console.warn("FriendsNotifier: Cannot navigate to profile. context.rcp.navigate not available.");
                        CustomToast.info("Cannot navigate to profile. Feature unavailable.");
                    }
                });
                entryDiv.innerHTML = logContent; // Set initial content without button
                entryDiv.appendChild(profileButton); // Append button as a child element
            } else {
                entryDiv.innerHTML = logContent;
            }
            // --- END "GO TO PROFILE" BUTTON ---

            contentDiv.prepend(entryDiv);
        }
    });
    console.log("FriendsNotifier: Log Panel content updated with filters applied.");
}


/**
 * Updates the content of the new stats panel with the latest friend statistics.
 */
function updateStatsPanelContent() {
    if (!statsPanelElement) {
        console.warn("FriendsNotifier: Cannot update stats panel content, statsPanelElement is null.");
        return;
    }

    const contentDiv = document.getElementById('friends-notifier-stats-content');
    if (!contentDiv) {
        console.error("FriendsNotifier: Stats Panel content div not found.");
        return;
    }

    contentDiv.innerHTML = ''; // Clear existing content

    const friendStatsArray = Object.values(friendStats);

    if (friendStatsArray.length === 0) {
        contentDiv.innerHTML = '<p style="text-align: center; margin-top: 20px;">No friend statistics available yet.</p>';
        return;
    }

    const lowerCaseQuery = statsPanelFriendSearchQuery.toLowerCase();

    const filteredStats = friendStatsArray.filter(stat => {
        const fullName = `${stat.riotId}`.toLowerCase();
        const displayName = (stat.name || '').toLowerCase();
        return fullName.includes(lowerCaseQuery) || displayName.includes(lowerCaseQuery);
    }).sort((a, b) => (a.name || '').localeCompare(b.name || '')); // Sort alphabetically by name

    if (filteredStats.length === 0) {
        contentDiv.innerHTML = '<p style="text-align: center; margin-top: 20px;">No friends match your search.</p>';
        return;
    }

    filteredStats.forEach(stat => {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'stats-entry';

        // Profile Icon (using placeholder as client icons are complex to load)
        const profileIconUrl = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${stat.profileIcon}.jpg`;
        const fallbackIconUrl = `https://placehold.co/30x30/333/EEE?text=P`; // Generic placeholder

        entryDiv.innerHTML = `
            <img class="friend-icon" src="${profileIconUrl}" onerror="this.onerror=null;this.src='${fallbackIconUrl}';" alt="Icon">
            <div class="friend-details">
                <div class="friend-name">${stat.name} (${stat.riotId})</div>
                <div class="stat-line">Status: ${stat.isConnected ? 'Online' : 'Offline'}</div>
                <div class="stat-line">Last Online: ${stat.lastConnectedTimestamp ? new Date(stat.lastConnectedTimestamp).toLocaleString('fr-FR') : 'Never'}</div>
                <div class="stat-line">Last Offline: ${stat.lastDisconnectedTimestamp ? new Date(stat.lastDisconnectedTimestamp).toLocaleString('fr-FR') : 'Never'}</div>
                <div class="stat-line">Total Online Time: ${formatDuration(stat.totalOnlineTime)}</div>
                <div class="stat-line">Total Status Changes: ${stat.statusChanges}</div>
            </div>
        `;
        contentDiv.appendChild(entryDiv);
    });
    console.log("FriendsNotifier: Stats Panel content updated with filters applied.");
}


/**
 * Makes an HTML element draggable within its parent.
 * @param {HTMLElement} elmnt - The element to make draggable.
 * @param {HTMLElement} dragHandle - The element that acts as the drag handle.
 * @param {string} dataStorePrefix - Prefix for DataStore keys (e.g., 'RN_log_panel' or 'RN_stats_panel').
 */
function makeElementDraggable(elmnt, dragHandle, dataStorePrefix) {
    let pos3 = 0, pos4 = 0; // Initial mouse position

    const dragStart = (e) => {
        console.log("FriendsNotifier: DragStart detected on header.");
        e = e || window.event;
        e.preventDefault(); // Prevent default browser drag behavior
        e.stopPropagation(); // Stop event from bubbling up to parent elements

        pos3 = e.clientX;
        pos4 = e.clientY;
        dragHandle.classList.add('dragging');

        document.addEventListener('mouseup', dragEnd);
        document.addEventListener('mousemove', elementDrag);
        console.log("FriendsNotifier: Drag listeners attached.");
    };

    const elementDrag = (e) => {
        e = e || window.event;
        e.preventDefault();

        let newTop = (elmnt.offsetTop - (pos4 - e.clientY));
        let newLeft = (elmnt.offsetLeft - (pos3 - e.clientX));

        pos3 = e.clientX;
        pos4 = e.clientY;

        const boundedTop = Math.max(0, Math.min(newTop, window.innerHeight - elmnt.offsetHeight));
        const boundedLeft = Math.max(0, Math.min(newLeft, window.innerWidth - elmnt.offsetWidth));

        elmnt.style.top = boundedTop + "px";
        elmnt.style.left = boundedLeft + "px";

        // Persist position based on prefix
        const positionToSave = { top: boundedTop, left: boundedLeft };
        DataStore.set(`${dataStorePrefix}_position`, positionToSave);

        // Update the global position variable for the correct panel
        if (dataStorePrefix === 'RN_log_panel') {
            logPanelPosition = positionToSave;
        } else if (dataStorePrefix === 'RN_stats_panel') {
            statsPanelPosition = positionToSave;
        }
    };

    const dragEnd = () => {
        console.log("FriendsNotifier: DragEnd detected.");
        dragHandle.classList.remove('dragging');
        document.removeEventListener('mouseup', dragEnd);
        document.removeEventListener('mousemove', elementDrag);
        console.log("FriendsNotifier: Drag listeners removed.");
    };

    dragHandle.addEventListener('mousedown', dragStart);
}

/**
 * Makes an HTML element resizable using specific handles.
 * @param {HTMLElement} elmnt - The element to make resizable.
 * @param {HTMLElement} handle - The resize handle element.
 * @param {string} type - The type of handle ('tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r').
 * @param {string} dataStorePrefix - Prefix for DataStore keys (e.g., 'RN_log_panel' or 'RN_stats_panel').
 */
function makeElementResizable(elmnt, handle, type, dataStorePrefix) {
    let startX, startY, startWidth, startHeight, startLeft, startTop;

    const resizeStart = (e) => {
        console.log(`FriendsNotifier: ResizeStart (${type}) detected for ${dataStorePrefix}.`);
        e = e || window.event;
        e.preventDefault();
        e.stopPropagation();

        startX = e.clientX;
        startY = e.clientY;
        startWidth = elmnt.offsetWidth;
        startHeight = elmnt.offsetHeight;
        startLeft = elmnt.offsetLeft;
        startTop = elmnt.offsetTop;

        document.addEventListener('mousemove', resizeMove);
        document.addEventListener('mouseup', resizeEnd);
        console.log(`FriendsNotifier: Resize listeners attached for ${type} on ${dataStorePrefix}.`);
    };

    const resizeMove = (e) => {
        e = e || window.event;
        e.preventDefault();

        let deltaX = e.clientX - startX;
        let deltaY = e.clientY - startY;

        let newWidth = startWidth;
        let newHeight = startHeight;
        let newLeft = startLeft;
        let newTop = startTop;

        const minW = MIN_PANEL_WIDTH;
        const minH = MIN_PANEL_HEIGHT;

        switch (type) {
            case 'tl':
                newWidth = Math.max(minW, startWidth - deltaX);
                newHeight = Math.max(minH, startHeight - deltaY);
                newLeft = startLeft + (startWidth - newWidth);
                newTop = startTop + (startHeight - newHeight);
                break;
            case 'tr':
                newWidth = Math.max(minW, startWidth + deltaX);
                newHeight = Math.max(minH, startHeight - deltaY);
                newTop = startTop + (startHeight - newHeight);
                break;
            case 'bl':
                newWidth = Math.max(minW, startWidth - deltaX);
                newHeight = Math.max(minH, startHeight + deltaY);
                newLeft = startLeft + (startWidth - newWidth);
                break;
            case 'br':
                newWidth = Math.max(minW, startWidth + deltaX);
                newHeight = Math.max(minH, startHeight + deltaY);
                break;
            case 't':
                newHeight = Math.max(minH, startHeight - deltaY);
                newTop = startTop + deltaY;
                break;
            case 'b':
                newHeight = Math.max(minH, startHeight + deltaY);
                break;
            case 'l':
                newWidth = Math.max(minW, startWidth - deltaX);
                newLeft = startLeft + deltaX;
                break;
            case 'r':
                newWidth = Math.max(minW, startWidth + deltaX);
                break;
        }

        elmnt.style.width = newWidth + 'px';
        elmnt.style.height = newHeight + 'px';
        elmnt.style.left = newLeft + 'px';
        elmnt.style.top = newTop + 'px';

        const sizeToSave = { width: newWidth, height: newHeight };
        const positionToSave = { top: newTop, left: newLeft };

        DataStore.set(`${dataStorePrefix}_size`, sizeToSave);
        DataStore.set(`${dataStorePrefix}_position`, positionToSave);

        if (dataStorePrefix === 'RN_log_panel') {
            logPanelSize = sizeToSave;
            logPanelPosition = positionToSave;
        } else if (dataStorePrefix === 'RN_stats_panel') {
            statsPanelSize = sizeToSave;
            statsPanelPosition = positionToSave;
        }
    };

    const resizeEnd = () => {
        console.log(`FriendsNotifier: ResizeEnd (${type}) detected for ${dataStorePrefix}.`);
        document.removeEventListener('mousemove', resizeMove);
        document.removeEventListener('mouseup', resizeEnd);
        console.log(`FriendsNotifier: Resize listeners removed for ${type} on ${dataStorePrefix}.`);
    };

    handle.addEventListener('mousedown', resizeStart);
}

// --- END UI PANEL CODE ---

// --- SOUND CODE ---
let audioContext;
let masterGainNode; // For overall sound control

/**
 * Initializes the Web Audio API context.
 * This should be called on a user interaction (like script load or first toast)
 * to avoid browser autoplay policy issues.
 */
function initAudioContext() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            // Create a master gain node for overall volume control
            masterGainNode = audioContext.createGain();
            // Set initial volume based on persisted settings
            masterGainNode.gain.setValueAtTime(filterSettings.isGloballyMuted ? 0 : filterSettings.soundVolume, audioContext.currentTime);
            masterGainNode.connect(audioContext.destination);
            console.log("FriendsNotifier: AudioContext initialized.");
        } catch (e) {
            console.error("FriendsNotifier: Web Audio API is not supported in this browser environment or failed to initialize.", e);
            audioContext = null;
        }
    }
    // Attempt to resume context if it's suspended (common for initial user interaction)
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            console.log("FriendsNotifier: AudioContext resumed successfully.");
        }).catch(e => {
            console.error("FriendsNotifier: Failed to resume AudioContext:", e);
        });
    }
}

/**
 * Plays a simple beep sound using Web Audio API.
 * @param {number} frequency - The frequency of the beep in Hz (e.g., 440 for A4).
 * @param {number} duration - The duration of the beep in seconds.
 * @param {number} volume - The volume (0 to 1). This is relative to masterGainNode.
 * @param {OscillatorType} type - The type of oscillator wave (e.g., 'sine', 'square', 'triangle', 'sawtooth').
 */
function playBeep(frequency, duration, volume, type = 'sine') {
    if (!audioContext || !masterGainNode || !enabled) {
        return;
    }

    const now = audioContext.currentTime;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = type; // Use provided type
    oscillator.frequency.setValueAtTime(frequency, now);

    // Set initial volume and then fade out
    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration); // Fade out to near zero

    oscillator.connect(gainNode);
    gainNode.connect(masterGainNode); // Connect to master gain node

    oscillator.start(now);
    oscillator.stop(now + duration);

    // Clean up resources after sound finishes
    oscillator.onended = () => {
        oscillator.disconnect();
        gainNode.disconnect();
    };
}

/**
 * Plays a specific sound for a connection event based on the selected sound pack.
 */
function playConnectSound() {
    const preset = soundPresets[filterSettings.selectedSoundPack].connect;
    playBeep(preset.freq, preset.dur, preset.vol, preset.type);
}

/**
 * Plays a specific sound for a disconnection event based on the selected sound pack.
 */
function playDisconnectSound() {
    const preset = soundPresets[filterSettings.selectedSoundPack].disconnect;
    playBeep(preset.freq, preset.dur, preset.vol, preset.type);
}

/**
 * Plays a specific sound for a general status change based on the selected sound pack.
 */
function playStatusChangeSound() {
    const preset = soundPresets[filterSettings.selectedSoundPack].statusChange;
    playBeep(preset.freq, preset.dur, preset.vol, preset.type);
}

/**
 * Plays a subtle sound for other informational events (e.g., friend added/removed) based on the selected sound pack.
 */
function playInfoSound() {
    const preset = soundPresets[filterSettings.selectedSoundPack].info;
    playBeep(preset.freq, preset.dur, preset.vol, preset.type);
}

// --- END SOUND CODE ---


/**
 * A utility function to create a delay.
 * @param {number} t - The delay time in milliseconds.
 * @returns {Promise<void>} A promise that resolves after the specified delay.
 */
const delay = (t) => new Promise((r) => setTimeout(r, t));

/**
 * Creates a button to toggle the Friends Notifier panel visibility.
 * This function is now only used internally by addToggleButtonsToClient
 * to create the *one* History button for the client's social sidebar.
 * @param {string} type - 'history' (only 'history' is expected now for external toggle)
 * @returns {HTMLElement} The created button element.
 */
async function createToggleButton(type) {
    const toggleButton = document.createElement("div");
    toggleButton.classList.add("social-button"); // Keep for client styling consistency

    let buttonText = '';
    let buttonIcon = '';
    let clickHandler;
    let customClass = ''; // For our specific identifiers

    if (type === 'history') {
        buttonText = "History";
        buttonIcon = groupIcon; // The friends group icon for history
        clickHandler = toggleLogPanel;
        customClass = 'friends-notifier-toggle-button';
        toggleButton.setAttribute('data-friends-notifier-button', 'true'); // NEW: Custom attribute to identify our buttons
    } else {
        // This 'else' block should ideally not be hit if used correctly
        // but included for robustness if type is unexpectedly not 'history'
        console.warn(`FriendsNotifier: createToggleButton called with unexpected type: ${type}. Creating generic button.`);
        buttonText = "Unknown";
        buttonIcon = '';
        clickHandler = () => console.log('Generic button clicked!');
        // No data-friends-notifier-button attribute for generic/non-history buttons
    }

    toggleButton.classList.add(customClass); // Add our specific class
    toggleButton.textContent = buttonText;
    toggleButton.addEventListener("click", clickHandler);

    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(buttonIcon, "image/svg+xml");
    const svgElement = svgDoc.documentElement;
    svgElement.classList.add(`${customClass.split('-')[0]}-button-icon`); // e.g., 'friends-button-icon'
    toggleButton.prepend(svgElement);

    return toggleButton;
}

/**
 * Periodically enforces that only one instance of our custom "History" button exists.
 * This is a failsafe against dynamic UI re-rendering in the client creating duplicates.
 */
function enforceSingleToggleButton() {
    // Select all elements that match our specific button classes AND our data attribute
    const allOurHistoryButtons = document.querySelectorAll('.social-button.friends-notifier-toggle-button[data-friends-notifier-button="true"]');

    if (allOurHistoryButtons.length > 1) {
        console.log(`FriendsNotifier: Found ${allOurHistoryButtons.length} duplicate custom history buttons. Removing extras.`);
        // Keep the first one and remove the rest
        for (let i = 1; i < allOurHistoryButtons.length; i++) {
            allOurHistoryButtons[i].remove();
        }
    }
}


/**
 * Attempts to add the single 'History' toggle button to the client's social sidebar.
 * This function includes aggressive cleanup to remove any previous instances of *our* buttons
 * and ensures only one *our* 'History' button is added.
 */
async function addToggleButtonsToClient() {
    console.log("FriendsNotifier Debug: addToggleButtonsToClient called.");

    // Phase 1: Aggressively clean up ANY existing instances of *our* custom buttons
    // We now use the data-friends-notifier-button attribute to reliably target ONLY our buttons.
    const existingOurButtons = document.querySelectorAll("[data-friends-notifier-button='true']");
    if (existingOurButtons.length > 0) {
        console.log(`FriendsNotifier Debug: Found ${existingOurButtons.length} existing instances of OUR buttons. Removing them.`);
        existingOurButtons.forEach(button => button.remove());
    }

    // Phase 2: Check if *our* history button exists after cleanup.
    // This is an idempotency check: if it's already there, another call of this function
    // (e.g., from a concurrent DOM mutation) likely placed it.
    let historyButtonAlreadyInDom = document.querySelector(".friends-notifier-toggle-button[data-friends-notifier-button='true']");
    if (historyButtonAlreadyInDom) {
        console.log("FriendsNotifier Debug: OUR History button already exists after cleanup. Skipping re-creation for this call.");
        // Ensure panels are created even if button already exists (important for initial load)
        if (!logPanelElement || !document.body.contains(logPanelElement)) {
            createLogPanel();
        }
        if (!statsPanelElement || !document.body.contains(statsPanelElement)) {
            createStatsPanel();
        }
        // Successfully placed, so we can stop observing DOM changes for this purpose
        domChange.off(addToggleButtonsToClient);
        return;
    }

    // Phase 3: Identify the best target element to append the button.
    // Based on user's HTML and common client structure.
    let targetElement = document.querySelector('.lol-social-sidebar'); // Primary target
    if (!targetElement) {
        // Fallback to a broader social container if specific sidebar isn't found
        targetElement = document.querySelector('.identity-and-parties');
        if (targetElement) {
            console.warn("FriendsNotifier Debug: .lol-social-sidebar not found, falling back to .identity-and-parties.");
        }
    }
    // No more broad fallbacks like .alpha-version-panel to prevent proliferation in unexpected places.


    if (targetElement) {
        let historyButton;
        try {
            // ONLY create the history button
            historyButton = await createToggleButton('history');
        } catch (err) {
            console.error("FriendsNotifier: Error creating history toggle button:", err);
            return;
        }

        if (historyButton) {
            // Append the button to the target element
            targetElement.appendChild(historyButton);
            console.log("FriendsNotifier Debug: History toggle button appended to target element.");

            // Always ensure panels are created, as their visibility is independent
            createLogPanel();
            createStatsPanel();

            // Successfully placed, so we can stop observing DOM changes for this purpose
            domChange.off(addToggleButtonsToClient);
        } else {
            console.warn("FriendsNotifier Debug: createToggleButton returned null for history button, could not append.");
        }
    } else {
        console.warn("FriendsNotifier Debug: No suitable element found to attach OUR toggle button. Keeping DOM observer active.");
        // If no target is found, keep observing for future DOM changes that might reveal one
        domChange.on(addToggleButtonsToClient);
    }
}


/**
 * Initializes the script by observing friend and friend request changes.
 * This function is called by PenguLoader when the script is loaded.
 * @param {object} context - The context object provided by PenguLoader, containing socket and other utilities.
 */
export async function init(context) {
    console.log("FriendsNotifier: init() called.");

    // Store context globally for profile navigation
    window.context = context;

    // Inject styles early to ensure they are available for both panels
    if (!document.getElementById('friends-notifier-styles')) {
        const styleTag = document.createElement('style');
        styleTag.id = 'friends-notifier-styles';
        styleTag.textContent = panelStyles;
        document.head.appendChild(styleTag);
        console.log("FriendsNotifier: Initial styles injected during init.");
    }

    // Increased delay for UI to settle before attempting button injection
    await delay(3000); // Increased to 3 seconds for more stability

    // Add resize listeners for both panels
    window.addEventListener('resize', repositionLogPanel);
    window.addEventListener('resize', repositionStatsPanel);


    // Listen for the UI framework to be ready, then attempt to add our toggle button
    context.rcp.whenReady('rcp-fe-lol-uikit')
        .then(_uikit => {
            console.log("FriendsNotifier: rcp-fe-lol-uikit is ready.");
            domChange.on(addToggleButtonsToClient); // Observe and add buttons dynamically
            addToggleButtonsToClient(); // Initial attempt to add the buttons

            // NEW: Start periodic cleanup of duplicate buttons
            setInterval(enforceSingleToggleButton, 1000); // Run every 10 seconds
            console.log("FriendsNotifier: Started periodic duplicate button cleanup (every 10 seconds).");
        })
        .catch(err => {
            console.error("FriendsNotifier: Failed to wait for rcp-fe-lol-uikit:", err);
        });

    context.socket.observe('/lol-chat/v1/friends', (data) => {
        if (!enabled) return;

        if (data.eventType == 'Update') {
            const friendData = data.data;
            const friendId = friendData.id;
            const now = new Date().toISOString();

            // Initialize friend stats if not present
            if (!friendStats[friendId]) {
                friendStats[friendId] = {
                    name: friendData.name || friendData.gameName,
                    riotId: `${friendData.gameName}#${friendData.gameTag}`,
                    profileIcon: friendData.profileIcon || 0, // Default to 0 if not available
                    lastConnectedTimestamp: null,
                    lastDisconnectedTimestamp: null,
                    totalOnlineTime: 0,
                    totalOfflineTime: 0,
                    statusChanges: 0,
                    isConnected: false,
                    lastStatusUpdate: now
                };
            }

            let currentStats = friendStats[friendId];
            let lastS = lastStatus.find((f) => f.id == friendId);
            const oldAvailability = lastS ? lastS.availability : 'unknown';

            // Update lastStatus tracking
            if (lastS) {
                lastS.availability = friendData.availability;
            } else {
                lastStatus.push({ id: friendId, availability: friendData.availability, name: friendData.name });
            }

            // Create a mock log object for shouldNotifyAndLog and shouldPlaySound
            const logEntryForFilter = {
                type: '', // Will be determined below
                id: friendData.id,
                name: friendData.name,
                riotId: friendData.gameName,
                riotTag: friendData.gameTag,
                oldAvailability: oldAvailability,
                newAvailability: friendData.availability,
                productName: friendData.productName || null,
                gameMode: (friendData.lol && friendData.lol.gameMode) ? friendData.lol.gameMode : null
            };

            if (oldAvailability === 'unknown' || (oldAvailability === 'offline' && friendData.availability !== 'offline')) {
                // Friend just appeared or came online from truly unknown/offline state
                logEntryForFilter.type = 'Connected';
                currentStats.lastConnectedTimestamp = now;
                if (!currentStats.isConnected) { // If was previously disconnected, start new online session
                    const offlineDuration = currentStats.lastDisconnectedTimestamp ? new Date(now).getTime() - new Date(currentStats.lastDisconnectedTimestamp).getTime() : 0;
                    currentStats.totalOfflineTime += offlineDuration;
                }
                currentStats.isConnected = true;
                if (shouldNotifyAndLog(logEntryForFilter) && friendData.availability === 'chat') {
                    CustomToast.success(`${friendData.name} (${friendData.gameName}#${friendData.gameTag}) has connected!`);
                }
                if (shouldPlaySound(logEntryForFilter) && friendData.availability === 'chat') {
                    playConnectSound();
                }
            } else if (friendData.availability === 'offline' && oldAvailability !== 'offline') {
                // Friend went offline
                logEntryForFilter.type = 'Disconnected';
                currentStats.lastDisconnectedTimestamp = now;
                if (currentStats.isConnected && currentStats.lastConnectedTimestamp) {
                    const onlineDuration = new Date(now).getTime() - new Date(currentStats.lastConnectedTimestamp).getTime();
                    currentStats.totalOnlineTime += onlineDuration;
                }
                currentStats.isConnected = false;
                if (shouldNotifyAndLog(logEntryForFilter)) {
                    CustomToast.error(`${friendData.name} (${friendData.gameName}#${friendData.gameTag}) has disconnected!`);
                }
                if (shouldPlaySound(logEntryForFilter)) {
                    playDisconnectSound();
                }
            } else if (oldAvailability !== friendData.availability) {
                // Status changed but not connect/disconnect transition (e.g., chat to away, away to dnd)
                logEntryForFilter.type = 'Friend Status Changed';
                currentStats.statusChanges++;
                if (shouldNotifyAndLog(logEntryForFilter)) {
                    let toastMessage = `${friendData.name} (${friendData.gameName}#${friendData.gameTag})`;
                    if (friendData.productName && friendData.productName !== 'League of Legends' && friendData.productName !== 'Riot Client') {
                        toastMessage += ` [${friendData.productName}]`;
                    }
                    if (friendData.lol && friendData.lol.gameMode) {
                        toastMessage += ` (${friendData.lol.gameMode})`;
                    }
                    CustomToast.info(`${toastMessage} changed status to ${friendData.availability}`);
                }
                if (shouldPlaySound(logEntryForFilter)) {
                    playStatusChangeSound();
                }
            }

            // Only push to logs if a specific event type was determined
            if (logEntryForFilter.type && Array.isArray(logs)) {
                logs.push({
                    type: logEntryForFilter.type,
                    id: friendData.id,
                    name: friendData.name,
                    riotId: friendData.gameName,
                    riotTag: friendData.gameTag,
                    oldAvailability: oldAvailability,
                    newAvailability: friendData.availability,
                    time: now,
                    productName: logEntryForFilter.productName,
                    gameMode: logEntryForFilter.gameMode
                });
            } else if (!Array.isArray(logs)) {
                console.error("FriendsNotifier: 'logs' is not an array when attempting to push event.");
            }

            // Update basic friend info in stats and save
            currentStats.name = friendData.name || friendData.gameName;
            currentStats.riotId = `${friendData.gameName}#${friendData.gameTag}`;
            currentStats.profileIcon = friendData.profileIcon || 0;
            currentStats.lastStatusUpdate = now;
            friendStats[friendId] = currentStats; // Ensure the object is updated in the map
            DataStore.set('RN_friend_stats', friendStats);
            updateLogPanelContent();
            updateStatsPanelContent(); // Update stats panel on friend status change

        } else if (data.eventType == "Delete") {
            const id = data.uri.split('/')[4];
            const friend = friends.find((f) => f.pid === id);
            if (friend) {
                const now = new Date().toISOString();
                const mockLog = {
                    type: 'Friend Removed',
                    id: friend.id,
                    name: friend.name,
                    riotId: friend.gameName,
                    riotTag: friend.gameTag,
                    productName: friend.productName || null,
                    gameMode: (friend.lol && friend.lol.gameMode) ? friend.lol.gameMode : null
                };
                if (shouldNotifyAndLog(mockLog)) {
                    CustomToast.error(`Your friend ${friend.name} (${friend.gameName}#${friend.gameTag}) deleted you from the friend list`);
                }
                if (shouldPlaySound(mockLog)) {
                    playInfoSound();
                }

                const index = lastStatus.findIndex(s => s.id === friend.id);
                if (index > -1) {
                    lastStatus.splice(index, 1);
                }
                if (Array.isArray(logs)) {
                    logs.push({
                        type: 'Friend Removed',
                        id: friend.id,
                        name: friend.name,
                        riotId: friend.gameName,
                        riotTag: friend.gameTag,
                        time: now,
                        productName: mockLog.productName,
                        gameMode: mockLog.gameMode
                    });
                } else {
                    console.error("FriendsNotifier: 'logs' is not an array when attempting to push 'Friend Removed' event.");
                }

                // Update friendStats for removed friend
                if (friendStats[friend.id]) {
                    if (friendStats[friend.id].isConnected && friendStats[friend.id].lastConnectedTimestamp) {
                        const onlineDuration = new Date(now).getTime() - new Date(friendStats[friend.id].lastConnectedTimestamp).getTime();
                        friendStats[friend.id].totalOnlineTime += onlineDuration;
                    }
                    friendStats[friend.id].isConnected = false;
                    friendStats[friend.id].lastDisconnectedTimestamp = now;
                    friendStats[friend.id].lastStatusUpdate = now;
                    // We don't delete from friendStats, just update their disconnected status to retain history
                    DataStore.set('RN_friend_stats', friendStats);
                }

                updateLogPanelContent();
                updateStatsPanelContent(); // Update stats panel on friend removal
            }
        }
        else if (data.eventType == 'Create') {
            const friendData = data.data;
            friends.push(friendData); // Add new friend to global friends list
            const received = friendsReqs.find((f) => f.pid === friendData.pid);
            if (received) return; // Already processed as a friend request, now it's an accepted friend

            const now = new Date().toISOString();
            // Initialize stats for newly added friend
            friendStats[friendData.id] = {
                name: friendData.name || friendData.gameName,
                riotId: `${friendData.gameName}#${friendData.gameTag}`,
                profileIcon: friendData.profileIcon || 0,
                lastConnectedTimestamp: now,
                lastDisconnectedTimestamp: null,
                totalOnlineTime: 0,
                totalOfflineTime: 0,
                statusChanges: 0,
                isConnected: true, // Assuming they are connected when added
                lastStatusUpdate: now
            };
            DataStore.set('RN_friend_stats', friendStats);


            const mockLog = {
                type: 'Friend Added',
                id: friendData.id,
                name: friendData.name,
                riotId: friendData.gameName,
                riotTag: friendData.gameTag,
                productName: friendData.productName || null,
                gameMode: (friendData.lol && friendData.lol.gameMode) ? friendData.lol.gameMode : null
            };
            if (shouldNotifyAndLog(mockLog)) {
                CustomToast.success(`${friendData.name} (${friendData.gameName}#${friendData.gameTag}) accepted your friend request`);
            }
            if (shouldPlaySound(mockLog)) {
                playInfoSound();
            }

            if (Array.isArray(logs)) {
                logs.push({
                    type: 'Friend Added',
                    id: friendData.id,
                    name: friendData.name,
                    riotId: friendData.gameName,
                    riotTag: friendData.gameTag,
                    time: now,
                    productName: mockLog.productName,
                    gameMode: mockLog.gameMode
                });
            } else {
                console.error("FriendsNotifier: 'logs' is not an array when attempting to push 'Friend Added' event.");
            }
            updateLogPanelContent();
            updateStatsPanelContent(); // Update stats panel on friend addition
        }
    });

    context.socket.observe('/lol-chat/v1/me', (data) => {
        if (!enabled) return;

        if (data.eventType === 'Update') {
            const myData = data.data;
            const currentAvailability = myData.availability;

            const mockLog = {
                type: 'My Status Changed',
                oldAvailability: lastMyStatus,
                newAvailability: currentAvailability
            };

            if (lastMyStatus === null) {
                lastMyStatus = currentAvailability;
                if (shouldNotifyAndLog(mockLog)) {
                    CustomToast.info(`You are currently online.`);
                }
                return;
            }

            if (lastMyStatus !== currentAvailability) {
                const oldStatus = lastMyStatus;
                lastMyStatus = currentAvailability;

                if (Array.isArray(logs)) {
                    logs.push({
                        type: 'My Status Changed',
                        oldAvailability: oldStatus,
                        newAvailability: currentAvailability,
                        time: new Date().toISOString()
                    });
                } else {
                    console.error("FriendsNotifier: 'logs' is not an array when attempting to push 'My Status Changed' event.");
                }
                updateLogPanelContent();

                if (shouldNotifyAndLog(mockLog)) {
                    if (currentAvailability === 'chat' && oldStatus !== 'chat') {
                        CustomToast.success(`You are now online!`);
                    } else if (oldStatus === 'chat' && currentAvailability !== 'chat') {
                        if (currentAvailability === 'offline') {
                            CustomToast.error(`You are now offline.`);
                        } else {
                            CustomToast.info(`Your status changed to ${currentAvailability}`);
                        }
                    } else {
                        CustomToast.info(`${currentAvailability}`);
                    }
                }

                if (shouldPlaySound(mockLog)) {
                    if (currentAvailability === 'chat' && oldStatus !== 'chat') {
                        playConnectSound();
                    } else if (oldStatus === 'chat' && currentAvailability !== 'chat') {
                        if (currentAvailability === 'offline') {
                            playDisconnectSound();
                        } else {
                            playStatusChangeSound();
                        }
                    } else {
                        playStatusChangeSound();
                    }
                }
            }
        }
    });
}

/**
 * Loads initial data when the script starts, such as the current friends list and pending requests.
 * This function is called by PenguLoader on script startup.
 */
export async function load() {
    console.log("FriendsNotifier: load() called.");

    await delay(100); // Small initial delay for PenguLoader environment to settle

    initAudioContext(); // Initialize audio context early
    CustomToast.init(); // Initialize custom toast system

    // Add CommandBar actions for both panels
    CommandBar.addAction({ name: 'Toggle FriendsNotifier', group: "FriendsNotifier", tags: ['fn', 'toggle fn', 'fn toggle', 'toggle'], perform: () => toggle() });
    CommandBar.addAction({
        name: 'Test Toast Notifications',
        group: "FriendsNotifier",
        tags: ['fn', 'test toast', 'toast'],
        perform: () => testToasts()
    });
    CommandBar.addAction({
        name: 'Test Sound Notifications',
        group: "FriendsNotifier",
        tags: ['fn', 'test sound', 'sound'],
        perform: () => testSounds()
    });
    CommandBar.addAction({
        name: 'Toggle History Panel',
        group: "FriendsNotifier",
        tags: ['fn', 'panel', 'history panel', 'toggle panel'],
        perform: () => toggleLogPanel()
    });
    // Keep this CommandBar action, as the user can still open the stats panel via the Command Bar
    CommandBar.addAction({
        name: 'Toggle Stats Panel',
        group: "FriendsNotifier",
        tags: ['fn', 'stats panel', 'toggle stats'],
        perform: () => toggleStatsPanel()
    });
    CommandBar.addAction({
        name: 'Open FriendsNotifier Settings',
        group: "FriendsNotifier",
        tags: ['fn', 'settings', 'filter'],
        perform: () => { toggleSettingsPanel(); if (!isSettingsPanelVisible) toggleSettingsPanel(); }
    });

    window.friendsNotifierLogs = logs; // Expose logs for debugging

    let f = await fetch('/lol-chat/v1/friends');
    friends = await f.json();

    while (friends.errorCode) {
        console.warn("FriendsNotifier: Error fetching initial friends list, retrying...", friends.errorCode);
        f = await fetch('/lol-chat/v1/friends');
        friends = await f.json();
        await delay(500);
    }
    console.log("FriendsNotifier: Fetched initial friends:", friends);

    // Initialize lastStatus and friendStats for existing friends on load
    friends.forEach(friend => {
        lastStatus.push({ id: friend.id, availability: friend.availability, name: friend.name });
        // Initialize friendStats for existing friends, if not already present
        if (!friendStats[friend.id]) {
            friendStats[friend.id] = {
                name: friend.name || friend.gameName,
                riotId: `${friend.gameName}#${friend.gameTag}`,
                profileIcon: friend.profileIcon || 0,
                lastConnectedTimestamp: friend.availability === 'chat' ? new Date().toISOString() : null,
                lastDisconnectedTimestamp: friend.availability !== 'chat' ? new Date().toISOString() : null,
                totalOnlineTime: 0,
                totalOfflineTime: 0,
                statusChanges: 0,
                isConnected: friend.availability === 'chat',
                lastStatusUpdate: new Date().toISOString()
            };
        } else {
             // Update connection status and last update time for existing stats on load
            friendStats[friend.id].isConnected = friend.availability === 'chat';
            friendStats[friend.id].lastStatusUpdate = new Date().toISOString();
            // If they are online, and no lastConnectedTimestamp, set it
            if (friendStats[friend.id].isConnected && !friendStats[friend.id].lastConnectedTimestamp) {
                friendStats[friend.id].lastConnectedTimestamp = new Date().toISOString();
            }
        }
    });
    DataStore.set('RN_friend_stats', friendStats); // Persist initial/updated stats

    let fgResponse = await fetch('/lol-chat/v1/friend-groups');
    friendsGroups = await fgResponse.json();
    while (friendsGroups.errorCode) {
        console.warn("FriendsNotifier: Error fetching initial friend groups, retrying...", friendsGroups.errorCode);
        fgResponse = await fetch('/lol-chat/v1/friend-groups');
        friendsGroups = await fgResponse.json();
        await delay(500);
    }
    console.log("FriendsNotifier: Fetched friend groups:", friendsGroups);

    try {
        const myResponse = await fetch('/lol-chat/v1/me');
        const myData = await myResponse.json();
        if (myData && myData.availability) {
            lastMyStatus = myData.availability;
        }
    } catch (error) {
        console.error("FriendsNotifier: Error fetching initial '/lol-chat/v1/me' status:", error);
    }

    let frResponse = await fetch('/lol-chat/v1/friend-requests');
    let frs = await frResponse.json();

    while (frs.errorCode) {
        console.warn("FriendsNotifier: Error fetching initial friend requests, retrying...", frs.errorCode);
        frResponse = await fetch('/lol-chat/v1/friend-requests');
        frs = await frResponse.json();
        await delay(50000);
    }

    friendsReqs = filterRequests(frs);

    updateLogPanelContent(); // Initial content update
    updateStatsPanelContent(); // Initial stats panel content update

    // If the settings panel was last open, render it now
    if (isSettingsPanelVisible) {
        renderFilterSettings();
    }
}

/**
 * Toggles the enabled state of the FriendsNotifier.
 * Updates the DataStore and provides a CustomToast notification.
 */
function toggle() {
    let e = DataStore.get('RN_enabled', false);
    DataStore.set('RN_enabled', !e);

    enabled = !e;
    if (enabled) {
        CustomToast.success("You have successfully enabled FriendsNotifier");
    } else {
        CustomToast.error("You have successfully disabled FriendsNotifier");
    }
}

/**
 * Filters a list of friend requests to only include incoming requests.
 * @param {Array<object>} reqs - The array of raw friend request objects.
 * @returns {Array<object>} An array containing only incoming friend requests.
 */
function filterRequests(reqs) {
    if (!Array.isArray(reqs)) {
        console.warn("FriendsNotifier: filterRequests received non-array input:", reqs);
        return [];
    }
    const filtered = reqs.filter((fr) => {
        return fr.direction === 'in';
    });
    return filtered ? filtered : [];
}

/**
 * Function to display various types of toast notifications for testing purposes.
 */
function testToasts() {
    CustomToast.success("This is a SUCCESS toast message!");
    setTimeout(() => {
        CustomToast.error("This is an ERROR toast message!");
    }, 1500);
    setTimeout(() => {
        CustomToast.info("This is an INFO toast message!");
    }, 3000);
    setTimeout(() => {
        CustomToast.success("Connected: TestFriend#1234");
    }, 4500);
    setTimeout(() => {
        CustomToast.error("Disconnected: TestFriend#1234");
    }, 6000);
    setTimeout(() => {
        CustomToast.info("Your status changed to away");
    }, 7500);
}

/**
 * Function to test various sound notifications.
 */
function testSounds() {
    CustomToast.info("Playing test sounds...");
    playConnectSound();
    setTimeout(() => {
        playDisconnectSound();
    }, 1000);
    setTimeout(() => {
        playStatusChangeSound();
    }, 2000);
    setTimeout(() => {
        playInfoSound();
    }, 3000);
}
