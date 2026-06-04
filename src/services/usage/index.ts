import { MessageItem } from '../../core/types';
import { messageQueue, processingQueue, resumeTimer, countdownInterval, setProcessingQueue, setResumeTimer, setCountdownInterval } from '../../core/state';
import { debugLog } from '../../utils/logging';
import { showWarning, showInfo } from '../../utils/notifications';
import { updateWebviewContent } from '../../ui/webview';
import { processNextMessage } from '../../claude/communication';
import { generateMessageId } from '../../utils/id-generator';
import { getConfigValue, updateConfigValue } from '../../core/config';

export function isCurrentUsageLimit(output: string): boolean {
    try {
        const usageLimitPattern = /(Claude\s+)?usage\s+limit\s+reached.*?reset\s+at\s+(\d{1,2}[:\d]*(?:\s*[APM]{2})?(?:\s*\([^)]+\))?)/gi;
        const hourLimitPattern = /(\d+)-hour\s+limit\s+reached\s*[∙•·]\s*resets\s+(\d{1,2}[:\d]*(?:\s*[APM]{2})?(?:\s*\([^)]+\))?)/gi;
        const matches = [];
        let match;
        
        // Check for traditional "usage limit reached... reset at" pattern
        while ((match = usageLimitPattern.exec(output)) !== null) {
            matches.push({
                fullMatch: match[0],
                resetTime: match[2],
                index: match.index
            });
        }
        
        // Check for new "X-hour limit reached ∙ resets TIME" pattern
        while ((match = hourLimitPattern.exec(output)) !== null) {
            matches.push({
                fullMatch: match[0],
                resetTime: match[2],
                index: match.index
            });
        }
        
        if (matches.length === 0) {
            debugLog('⚠️ No usage limit with reset time found in output');
            return false;
        }
        
        const lastMatch = matches[matches.length - 1];
        const resetTime = lastMatch.resetTime;
        
        debugLog(`🕐 Found ${matches.length} usage limit occurrence(s), checking last one: "${lastMatch.fullMatch}"`);
        debugLog(`⏰ Reset time from last occurrence: "${resetTime}"`);
        
        const now = new Date();
        const resetDate = parseResetTime(resetTime, now);
        
        if (!resetDate) {
            debugLog('❌ Could not parse reset time, treating as current limit');
            return true;
        }
        
        const timeDiffMs = resetDate.getTime() - now.getTime();
        const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
        
        debugLog(`⏱️ Time until reset: ${timeDiffHours.toFixed(2)} hours`);
        
        const isWithin6Hours = timeDiffMs > 0 && timeDiffHours <= 6;
        
        debugLog(`✅ Is within 6-hour window: ${isWithin6Hours}`);
        return isWithin6Hours;
        
    } catch (error) {
        debugLog(`❌ Error checking usage limit timing: ${error}`);
        return true;
    }
}

function parseResetTime(resetTime: string, referenceTime: Date): Date | null {
    try {
        // Remove timezone info like (EST) and clean up
        const cleanTime = resetTime.replace(/\s*\([^)]+\)/, '').trim();
        
        // Extract AM/PM and time parts - handle both "4 am" and "4am" formats
        const ampmMatch = cleanTime.match(/(am|pm)$/i);
        const ampm = ampmMatch ? ampmMatch[0] : null;
        const timePartOnly = cleanTime.replace(/(am|pm)$/i, '').trim();
        
        let hours: number, minutes: number;
        
        if (timePartOnly.includes(':')) {
            const [hoursStr, minutesStr] = timePartOnly.split(':');
            hours = parseInt(hoursStr.replace(/[^\d]/g, ''));
            minutes = parseInt(minutesStr.replace(/[^\d]/g, ''));
            
            // Validate parsed values
            if (isNaN(hours) || isNaN(minutes)) {
                debugLog(`❌ Invalid time format: "${resetTime}"`);
                return null;
            }
        } else {
            hours = parseInt(timePartOnly.replace(/[^\d]/g, ''));
            minutes = 0;
            
            if (isNaN(hours)) {
                debugLog(`❌ Invalid time format: "${resetTime}"`);
                return null;
            }
        }
        
        // Validate hour and minute ranges
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            debugLog(`❌ Invalid time values: hours=${hours}, minutes=${minutes}`);
            return null;
        }
        
        const resetDate = new Date(referenceTime);
        let resetHours = hours;
        
        // Handle AM/PM conversion
        if (ampm) {
            const isPM = /pm/i.test(ampm);
            const isAM = /am/i.test(ampm);
            
            if (isPM && hours !== 12) {
                resetHours = hours + 12;
            } else if (isAM && hours === 12) {
                resetHours = 0;
            }
        }
        
        // Set the reset time
        resetDate.setHours(resetHours, minutes, 0, 0);
        
        // If the reset time is not in the future, move it to tomorrow
        // Use >= instead of <= to handle exact time matches (should always be next occurrence)
        if (resetDate.getTime() <= referenceTime.getTime()) {
            resetDate.setDate(resetDate.getDate() + 1);
        }
        
        return resetDate;
    } catch (error) {
        debugLog(`❌ Error parsing reset time "${resetTime}": ${error}`);
        return null;
    }
}

function calculateWaitTime(resetTime: string): number {
    if (resetTime === 'unknown time') {
        return 60;
    }
    
    try {
        const now = new Date();
        const resetDate = parseResetTime(resetTime, now);
        
        if (!resetDate) {
            debugLog('❌ Could not parse reset time for wait calculation');
            return 60;
        }
        
        const waitMs = resetDate.getTime() - now.getTime();
        return Math.max(1, Math.ceil(waitMs / (1000 * 60)));
    } catch (error) {
        return 60;
    }
}

export function handleUsageLimit(output: string, message: MessageItem): void {
    // Try traditional "reset at" pattern first
    let resetTimeMatch = output.match(/reset at (\d{1,2}[:\d]*(?:\s*[APM]{2})?(?:\s*\([^)]+\))?)/i);
    
    // If not found, try new "resets TIME" pattern  
    if (!resetTimeMatch) {
        resetTimeMatch = output.match(/resets\s+(\d{1,2}[:\d]*(?:\s*[APM]{2})?(?:\s*\([^)]+\))?)/i);
    }
    
    const resetTime = resetTimeMatch ? resetTimeMatch[1] : 'unknown time';
    
    setProcessingQueue(false);
    
    message.status = 'completed';
    message.completedAt = new Date().toISOString();
    message.output = 'Completed but hit usage limit';
    
    const existingContinue = messageQueue.find(msg => msg.text === 'continue' && msg.status === 'waiting');
    if (existingContinue) {
        debugLog('⚠️ Continue message already exists - not adding duplicate');
        return;
    }
    
    const currentMessageIndex = messageQueue.findIndex(msg => msg.id === message.id);
    
    const continueMessage: MessageItem = {
        id: generateMessageId(),
        text: 'continue',
        timestamp: new Date().toISOString(),
        status: 'waiting',
        error: `Usage limit reached - will resume at ${resetTime}`,
        waitUntil: Date.now() + (calculateWaitTime(resetTime) * 60 * 1000)
    };
    
    if (currentMessageIndex >= 0) {
        messageQueue.splice(currentMessageIndex + 1, 0, continueMessage);
    } else {
        messageQueue.push(continueMessage);
    }
    
    updateWebviewContent();
    
    const waitMinutes = calculateWaitTime(resetTime);
    const waitSeconds = waitMinutes * 60;
    
    showWarning(`Claude usage limit reached. Added "continue" message to queue. Will automatically resume processing at ${resetTime} (${waitMinutes} minutes)`);
    
    startCountdownTimer(continueMessage, waitSeconds);
}

function startCountdownTimer(message: MessageItem, waitSeconds: number): void {
    if (resumeTimer) {
        clearTimeout(resumeTimer);
        setResumeTimer(null);
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
        setCountdownInterval(null);
    }
    
    let remainingSeconds = waitSeconds;
    
    message.waitUntil = Date.now() + (remainingSeconds * 1000);
    
    const interval = setInterval(() => {
        remainingSeconds--;
        message.waitSeconds = remainingSeconds;
        
        const timeLeft = Math.max(0, Math.floor((message.waitUntil! - Date.now()) / 1000));
        if (timeLeft !== remainingSeconds) {
            remainingSeconds = timeLeft;
            message.waitSeconds = remainingSeconds;
        }
        
        updateWebviewContent();

        if (remainingSeconds <= 0) {
            if (countdownInterval) {
                clearInterval(countdownInterval);
                setCountdownInterval(null);
            }
            
            resumeProcessingFromWait(message);
        }
    }, 1000);
    
    setCountdownInterval(interval);

    const timer = setTimeout(() => {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            setCountdownInterval(null);
        }
        resumeProcessingFromWait(message);
    }, remainingSeconds * 1000);
    
    setResumeTimer(timer);
}

function resumeProcessingFromWait(message: MessageItem): void {
    message.status = 'pending';
    message.error = undefined;
    message.waitSeconds = undefined;
    message.waitUntil = undefined;
    updateWebviewContent();
    
    debugLog(`🔄 Resumed processing from wait - message ${message.id} status updated`);
    
    showInfo('Usage limit has reset. Resuming processing with "continue" message...');
    
    if (!processingQueue) {
        setProcessingQueue(true);
        setTimeout(() => {
            processNextMessage();
        }, 2000);
    }
}

export function recoverWaitingMessages(): void {
    const now = Date.now();
    
    messageQueue.forEach(message => {
        if (message.status === 'waiting' && message.waitUntil) {
            const timeLeft = Math.max(0, Math.floor((message.waitUntil - now) / 1000));
            
            if (timeLeft <= 0) {
                debugLog(`⏰ Timer expired for message ${message.id} - resuming immediately`);
                resumeProcessingFromWait(message);
            } else {
                debugLog(`⏰ Recovering timer for message ${message.id} - ${timeLeft} seconds remaining`);
                message.waitSeconds = timeLeft;
                startCountdownTimer(message, timeLeft);
            }
        }
    });
}

export function simulateUsageLimit(): void {
    const isDevelopmentMode = getConfigValue('developmentMode', false);
    
    if (!isDevelopmentMode) {
        showWarning('Development mode must be enabled to use debug features');
        return;
    }
    
    debugLog('🧪 Simulating usage limit with 10 seconds wait');
    
    setProcessingQueue(false);
    
    const existingContinue = messageQueue.find(msg => msg.text === 'continue' && msg.status === 'waiting');
    if (existingContinue) {
        debugLog('⚠️ Continue message already exists - not adding duplicate');
        return;
    }
    
    // Find the currently processing message (if any) to insert after it
    const currentProcessingIndex = messageQueue.findIndex(msg => msg.status === 'processing');
    
    const continueMessage: MessageItem = {
        id: generateMessageId(),
        text: 'continue',
        timestamp: new Date().toISOString(),
        status: 'waiting',
        error: 'DEBUG: Simulated usage limit - will resume in 10 seconds',
        waitUntil: Date.now() + (10 * 1000) // 10 sec
    };
    
    if (currentProcessingIndex >= 0) {
        // Insert after the currently processing message
        messageQueue.splice(currentProcessingIndex + 1, 0, continueMessage);
        debugLog(`🧪 Inserted continue message after processing message at index ${currentProcessingIndex}`);
    } else {
        // If no message is processing, insert at the beginning
        messageQueue.unshift(continueMessage);
        debugLog('🧪 Inserted continue message at beginning of queue (no processing message found)');
    }
    
    updateWebviewContent();
    
    showInfo('DEBUG: Simulated usage limit. Added "continue" message with 1-minute countdown.');
    
    startCountdownTimer(continueMessage, 10);
}

export function clearAllTimers(): void {
    const isDevelopmentMode = getConfigValue('developmentMode', false);
    
    if (!isDevelopmentMode) {
        showWarning('Development mode must be enabled to use debug features');
        return;
    }
    
    debugLog('🧪 Clearing all timers and waiting states');
    
    if (resumeTimer) {
        clearTimeout(resumeTimer);
        setResumeTimer(null);
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
        setCountdownInterval(null);
    }
    
    messageQueue.forEach(message => {
        if (message.status === 'waiting') {
            message.status = 'pending';
            message.error = undefined;
            message.waitSeconds = undefined;
            message.waitUntil = undefined;
        }
    });
    
    updateWebviewContent();
    showInfo('DEBUG: Cleared all timers and reset waiting messages to pending.');
}

export function debugQueueState(): void {
    const isDevelopmentMode = getConfigValue('developmentMode', false);
    
    if (!isDevelopmentMode) {
        showWarning('Development mode must be enabled to use debug features');
        return;
    }
    
    const queueInfo = {
        totalMessages: messageQueue.length,
        pending: messageQueue.filter(m => m.status === 'pending').length,
        processing: messageQueue.filter(m => m.status === 'processing').length,
        waiting: messageQueue.filter(m => m.status === 'waiting').length,
        completed: messageQueue.filter(m => m.status === 'completed').length,
        failed: messageQueue.filter(m => m.status === 'error').length,
        processingQueue: processingQueue,
        hasResumeTimer: !!resumeTimer,
        hasCountdownInterval: !!countdownInterval
    };
    
    debugLog(`🧪 Queue State Debug: ${JSON.stringify(queueInfo, null, 2)}`);
    
    const message = `Queue: ${queueInfo.totalMessages} total, ${queueInfo.pending} pending, ${queueInfo.processing} processing, ${queueInfo.waiting} waiting, ${queueInfo.completed} completed, ${queueInfo.failed} failed. Processing: ${queueInfo.processingQueue}`;
    showInfo(`DEBUG: ${message}`);
}