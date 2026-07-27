import type { Auth } from '@/types/auth';
import type { WorkspaceFlash } from '@/types/workspace';

declare module 'react' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            is_local_env: boolean;
            auth: Auth;
            flash: WorkspaceFlash | null;
            sidebarOpen: boolean;
            [key: string]: unknown;
        };
    }
}
