// auth/session/session.module.ts
import { Global, Module } from '@nestjs/common';
import { MemorySessionStore } from './memory-session.store';
import { SESSION_STORE } from './session.constant';

@Global()
@Module({
    providers: [
        {
            provide: SESSION_STORE,
            useClass: MemorySessionStore,
        },
    ],
    exports: [SESSION_STORE],
})
export class SessionModule { }
