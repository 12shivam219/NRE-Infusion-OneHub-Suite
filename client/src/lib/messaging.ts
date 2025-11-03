// Messaging initialization and management
let messagePort: MessagePort | null = null;

export function initializeMessaging() {
    // Handle chrome.runtime-like messaging for non-extension context
    window.addEventListener('message', (event) => {
        if (event.source === window && event.data && event.data.type === 'FROM_CONTENT_SCRIPT') {
            handleMessage(event.data);
        }
    });

    // Set up message channel for service worker communication
    // Only if service worker is already active and controller is ready
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        try {
            const channel = new MessageChannel();
            messagePort = channel.port1;

            messagePort.onmessage = (event) => {
                handleMessage(event.data);
            };

            // Add error handler to prevent uncaught promise rejection
            messagePort.onmessageerror = (event) => {
                console.warn('Message port error:', event.data);
            };

            try {
                navigator.serviceWorker.controller.postMessage({
                    type: 'INIT_PORT',
                }, [channel.port2]);
            } catch (error: unknown) {
                console.debug('Could not initialize service worker port:', error instanceof Error ? error.message : 'Unknown error');
                // This is non-critical - the app continues without the port
            }
        } catch (error) {
            console.debug('Service worker message port initialization failed:', error);
            // Non-critical error - continue without port
        }
    }
}

function handleMessage(message: any) {
    // Handle different message types
    switch (message.type) {
        case 'MODULE_SYNC':
            console.log('Module sync message received:', message);
            // Handle module sync
            break;
        case 'SERVICE_WORKER_ERROR':
            console.warn('Service worker error:', message.error);
            // Handle service worker errors
            break;
        default:
            // Handle other message types
            break;
    }
}

export function sendMessage(message: any) {
    if (messagePort) {
        messagePort.postMessage(message);
    } else {
        console.warn('Message port not initialized');
    }
}

// Initialize messaging when the module loads
initializeMessaging();