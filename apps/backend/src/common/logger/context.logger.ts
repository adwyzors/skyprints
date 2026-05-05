import { Logger } from '@nestjs/common';
import { RequestContextStore } from '../context/request-context.store';
import * as fs from 'fs';
import * as path from 'path';

// Log file configuration
const LOGS_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOGS_DIR, 'combined.log');

// Ensure logs directory exists (ONLY locally)
const isLocal = process.env.NODE_ENV === 'local' || !process.env.NODE_ENV;
if (isLocal && !fs.existsSync(LOGS_DIR)) {
    try {
        fs.mkdirSync(LOGS_DIR, { recursive: true });
    } catch (err) {
        console.warn('Could not create logs directory, file logging disabled', err);
    }
}

export class ContextLogger extends Logger {
    private writeToFile(level: string, message: any, trace?: any) {
        // Only log to file in local environment
        if (!isLocal) {
            return;
        }

        try {
            const timestamp = new Date().toISOString();
            const contextName = (this as any).context || 'App';
            
            let content = typeof message === 'object' ? JSON.stringify(message, null, 2) : message;
            if (trace) {
                const traceStr = typeof trace === 'object' ? JSON.stringify(trace, null, 2) : trace;
                content += `\nTrace: ${traceStr}`;
            }

            const logLine = `[${timestamp}] [${level.toUpperCase()}] [${contextName}] ${content}\n`;
            fs.appendFileSync(LOG_FILE, logLine);
        } catch (err) {
            // Fallback to console if file writing fails
            console.error('Failed to write to log file', err);
        }
    }

    log(message: any, context?: string) {
        const ctx = RequestContextStore.getStore();
        const msgStr = typeof message === 'object' ? JSON.stringify(message) : message;
        const formattedMessage = ctx?.correlationId
            ? `[cid=${ctx.correlationId}] ${msgStr}`
            : msgStr;
        
        this.writeToFile('log', formattedMessage);
        super.log(message, context || (this as any).context);
    }

    debug(message: any, context?: string) {
        const ctx = RequestContextStore.getStore();
        const msgStr = typeof message === 'object' ? JSON.stringify(message) : message;
        const formattedMessage = ctx?.correlationId
            ? `[cid=${ctx.correlationId}] ${msgStr}`
            : msgStr;
        
        this.writeToFile('debug', formattedMessage);
        super.debug(message, context || (this as any).context);
    }

    error(message: any, trace?: string, context?: string) {
        const ctx = RequestContextStore.getStore();
        const msgStr = typeof message === 'object' ? JSON.stringify(message) : message;
        const formattedMessage = ctx?.correlationId
            ? `[cid=${ctx.correlationId}] ${msgStr}`
            : msgStr;
        
        this.writeToFile('error', formattedMessage, trace);
        super.error(message, trace, context || (this as any).context);
    }

    warn(message: any, context?: string) {
        const ctx = RequestContextStore.getStore();
        const msgStr = typeof message === 'object' ? JSON.stringify(message) : message;
        const formattedMessage = ctx?.correlationId
            ? `[cid=${ctx.correlationId}] ${msgStr}`
            : msgStr;
        
        this.writeToFile('warn', formattedMessage);
        super.warn(message, context || (this as any).context);
    }
}
