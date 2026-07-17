import { router, usePage } from '@inertiajs/react';
import { Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';

interface User {
    id: number;
    name: string;
    email: string;
}

export function DevUserSwitcher() {
    const { is_local_env } = usePage().props as any;
    console.log('DevUserSwitcher props:', usePage().props);
    const [isOpen, setIsOpen] = useState(false);
    const [users, setUsers] = useState<User[]>([]);

    useEffect(() => {
        if (isOpen && users.length === 0) {
            fetch('/dev/users')
                .then((res) => res.json())
                .then((data) => setUsers(data));
        }
    }, [is_local_env, isOpen, users.length]);

    // if (!is_local_env) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50">
            {isOpen && (
                <div className="mb-2 w-64 rounded-xl border border-line bg-surface p-2 shadow-xl">
                    <div className="mb-2 px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-ink-soft border-b border-line">
                        Quick Login
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        {users.map((user) => (
                            <button
                                key={user.id}
                                onClick={() => router.post(`/dev/login/${user.id}`)}
                                className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-subtle focus:bg-surface-subtle focus:outline-none"
                            >
                                <div className="font-medium text-ink">{user.name}</div>
                                <div className="text-xs text-ink-soft">{user.email}</div>
                            </button>
                        ))}
                        {users.length === 0 && (
                            <div className="p-2 text-center text-sm text-ink-soft">
                                Loading users...
                            </div>
                        )}
                    </div>
                </div>
            )}
            <Button
                size="icon"
                onClick={() => setIsOpen(!isOpen)}
                className="h-12 w-12 rounded-full shadow-lg"
                title="Switch User (Dev)"
            >
                <Users className="h-5 w-5" />
            </Button>
        </div>
    );
}
