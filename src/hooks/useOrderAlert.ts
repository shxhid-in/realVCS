
"use client"

import { useState, useCallback, useRef, useEffect } from 'react';

// Create a loud, disturbing alarm sound using Web Audio API
const createAlarmSound = () => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  // Create multiple oscillators for a more complex, disturbing sound
  const oscillator1 = audioContext.createOscillator();
  const oscillator2 = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  // Connect oscillators to gain node
  oscillator1.connect(gainNode);
  oscillator2.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  // Create a harsh, attention-grabbing sound
  oscillator1.frequency.value = 1000; // High frequency
  oscillator1.type = 'sawtooth'; // Harsh waveform
  
  oscillator2.frequency.value = 800; // Lower frequency for depth
  oscillator2.type = 'square'; // Sharp waveform
  
  // Make it very loud and disturbing
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.8, audioContext.currentTime + 0.01); // Very loud
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.0); // Longer duration
  
  // Add frequency modulation for extra disturbance
  const lfo = audioContext.createOscillator();
  const lfoGain = audioContext.createGain();
  lfo.frequency.value = 5; // 5 Hz modulation
  lfoGain.gain.value = 200; // Frequency deviation
  lfo.connect(lfoGain);
  lfoGain.connect(oscillator1.frequency);
  
  // Start all oscillators
  lfo.start(audioContext.currentTime);
  oscillator1.start(audioContext.currentTime);
  oscillator2.start(audioContext.currentTime);
  
  // Stop after 1 second
  oscillator1.stop(audioContext.currentTime + 1.0);
  oscillator2.stop(audioContext.currentTime + 1.0);
  lfo.stop(audioContext.currentTime + 1.0);
  
  return audioContext;
};

export const useOrderAlert = () => {
    const audioIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const vibrationIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [isAlerting, setIsAlerting] = useState(false);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopAlert();
        };
    }, []);

    const stopAlert = useCallback(() => {
        setIsAlerting(false);

        // Stop audio
        if (audioIntervalRef.current) {
            clearInterval(audioIntervalRef.current);
            audioIntervalRef.current = null;
        }
        
        // Stop vibration
        if (vibrationIntervalRef.current) {
            clearInterval(vibrationIntervalRef.current);
            vibrationIntervalRef.current = null;
        }
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(0); // Stop any ongoing vibration
        }

        // Close any open browser notifications
        if (typeof window !== 'undefined' && 'Notification' in window) {
            // Close notifications with our tag
            if ('serviceWorker' in navigator && 'getRegistrations' in navigator.serviceWorker) {
                navigator.serviceWorker.getRegistrations().then(registrations => {
                    registrations.forEach(registration => {
                        registration.getNotifications({ tag: 'new-order-alert' }).then(notifications => {
                            notifications.forEach(notification => notification.close());
                        });
                    });
                });
            }
        }
    }, []);

    const startAlert = useCallback(() => {
        if (isAlerting) {
            return;
        }
        setIsAlerting(true);

        // Request notification permission and show browser notification via Service Worker
        if (typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator) {
            if (Notification.permission === 'granted') {
                // Use Service Worker to show notification
                navigator.serviceWorker.ready.then(registration => {
                    registration.showNotification('🚨 NEW ORDER ALERT!', {
                        body: 'You have new orders that need attention!',
                        icon: '/icons/icon-128.png',
                        badge: '/icons/icon-128.png',
                        tag: 'new-order-alert',
                        requireInteraction: true, // Requires user interaction to dismiss
                        silent: false,
                        vibrate: [300, 100, 300, 100, 300],
                        actions: [
                            {
                                action: 'view',
                                title: 'View Orders',
                                icon: '/icons/action-view.png'
                            },
                            {
                                action: 'close',
                                title: 'Close',
                                icon: '/icons/action-close.png'
                            }
                        ]
                    });
                }).catch(error => {
                    console.error('Failed to show notification via Service Worker:', error);
                });
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        // Use Service Worker to show notification
                        navigator.serviceWorker.ready.then(registration => {
                            registration.showNotification('🚨 NEW ORDER ALERT!', {
                                body: 'You have new orders that need attention!',
                                icon: '/icons/icon-128.png',
                                badge: '/icons/icon-128.png',
                                tag: 'new-order-alert',
                                requireInteraction: true,
                                silent: false,
                                vibrate: [300, 100, 300, 100, 300],
                                actions: [
                                    {
                                        action: 'view',
                                        title: 'View Orders',
                                        icon: '/icons/action-view.png'
                                    },
                                    {
                                        action: 'close',
                                        title: 'Close',
                                        icon: '/icons/action-close.png'
                                    }
                                ]
                            });
                        }).catch(error => {
                            console.error('Failed to show notification via Service Worker:', error);
                        });
                    }
                });
            }
        }

        // Play continuous alarm sound every 1.5 seconds for maximum disturbance
        if (typeof window !== 'undefined') {
            const playAlarm = () => {
                try {
                    createAlarmSound();
                } catch (e) {
                    console.error("Audio play failed:", e);
                }
            };
            
            playAlarm(); // Play immediately
            audioIntervalRef.current = setInterval(playAlarm, 1500); // Then every 1.5 seconds
        }

        // Start aggressive vibration pattern
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            vibrationIntervalRef.current = setInterval(() => {
                navigator.vibrate([300, 100, 300, 100, 300]); // Longer, more aggressive pattern
            }, 1500); // Every 1.5 seconds to match audio
        }
    }, [isAlerting]);

    return { startAlert, stopAlert, isAlerting };
};
