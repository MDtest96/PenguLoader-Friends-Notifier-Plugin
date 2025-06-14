# League Client Friends Notifier & Stats Plugin

A comprehensive Pengu Loader plugin that integrates directly into the League of Legends client, offering real-time friend activity notifications, a persistent event history, and detailed statistics for each friend in customizable, draggable, and resizable UI panels.

## Features

* **Real-time Notifications:** Get instant toast notifications for friend connections, disconnections, status changes, friend additions/removals, and friend request activities.
* **Persistent History Panel:** A dedicated in-game panel to view a chronological log of all monitored friend events.
    * Draggable and fully resizable.
    * Position and size persist across client restarts.
    * Clear log history button.
* **Detailed Friend Statistics Panel:** A new in-game panel that provides statistics for each friend, including:
    * Total online time.
    * Last connected/disconnected timestamps.
    * Number of status changes.
    * Search filter to find specific friends.
    * Draggable and fully resizable.
    * Position and size persist across client restarts.
* **Customizable Notifications:**
    * **Filter Mode:** Choose between a 'whitelist' (only notify for selected friends/groups) or 'blacklist' (notify for all except selected).
    * **Event Filtering:** Enable/disable notifications (toasts and logs) for specific event types (connect, disconnect, status change, etc.).
    * **Sound Control:** Select which event types trigger sounds, adjust global volume, and choose from different sound packs (Default, Chime, Click).
* **Enhanced Friend Status Messages:** Log entries and toasts include more detailed information like the game product and game mode (e.g., "Connected: FriendName#Tag [Valorant] (Teamfight Tactics)").
* **In-log Emote Display:** Custom text-based emotes (e.g., `:pog:`, `:heart:`) are displayed as emojis/images within the history log.
* **Global Mute:** Option to mute all notifications (toasts and sounds) with a single click.
* **Panel Customization:** Adjust the background opacity of both history and stats panels.
* **Launch on Startup:** Option to automatically open the history panel when the client starts.
* **Seamless Client Integration:** Toggle buttons for both panels are added directly into the League Client's social sidebar.
* **Robust Error Handling:** Includes console logging for debugging.

## Installation

This plugin requires [Pengu Loader](https://pengu.lol/) to be installed.

1.  **Download the plugin file:**
    * Go to the [Releases page](https://github.com/MDtest96/PenguLoader-Friends-Notifier-Plugin/releases) of this repository.
    * Download the `friends-notifier-main.js` file from the latest release.

2.  **Place the plugin file:**
    * Navigate to your League of Legends client installation directory.
    * Locate the `PenguLoader` folder (e.g., `C:\Riot Games\League of Legends\PenguLoader`).
    * Inside `PenguLoader`, find the `plugins` folder.
    * Place the downloaded `friends-notifier-main.js` file directly into the `plugins` folder.

3.  **Restart your League of Legends client.** The plugin should now be active.

## Usage

After installation and client restart:

1.  **Locate the Toggle Buttons:** Look for two new buttons, "History" and "Stats," in the League Client's social sidebar (usually on the left side of the client, near your friend list and other social actions).
2.  **Toggle Panels:**
    * Click the **"History"** button (with the group icon) to show/hide the Friend Status History panel.
    * Click the **"Stats"** button (with the bar chart icon) to show/hide the Friend Statistics panel.
3.  **Move & Resize Panels:** Both panels are fully draggable by their headers and resizable by dragging their edges and corners. Their position and size will be saved and restored the next time you launch the client.
4.  **Configure Settings:** Click the **⚙ (Gear) icon** within the "Friend Status History" panel's header to open the settings menu. Here you can:
    * Enable/disable global mute.
    * Adjust panel opacity.
    * Control which event types trigger notifications (toasts and logs).
    * Configure sound notifications (types, volume, sound packs).
    * Set up friend and group filters using whitelist/blacklist modes.
    * Use the search bar to find specific friends for filtering.
5.  **Clear History:** Within the "Friend Status History" panel, click the **🗑 (Trash Can) icon** to clear all past log entries.
6.  **Search Stats:** In the "Friend Statistics" panel, use the search bar to quickly find statistics for specific friends.

## Troubleshooting

* **Plugin not loading:**
    * Ensure `friends-notifier-main.js` is placed directly in the `PenguLoader/plugins` directory.
    * Verify Pengu Loader is correctly installed and running.
* **Errors in console:** If you encounter issues, open the League Client's developer tools (usually by pressing `Ctrl + Shift + I` or `F12` in the client window) and check the "Console" tab for error messages. Please copy and paste these errors when reporting issues.
* **"Error fetching initial friend requests, retrying... RESOURCE_NOT_FOUND"**: This warning indicates the plugin is trying to access a League Client API (LCU API) endpoint that might not be available at that exact moment or has changed. This often resolves itself with retries. If it persists, it might indicate a more significant issue or a breaking change in the LCU API that requires a plugin update.

## Contributing

If you'd like to contribute to this project (e.g., bug fixes, new features, improved styling), please feel free to open issues or submit pull requests. All contributions are welcome!

## License

This project is released under the [WTFPL – Do What The F*ck You Want To Public License](http://www.wtfpl.net/about/).
