<?php

namespace App\Platform\Notifications\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Notifications\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $pageSize = min(100, max(1, $request->integer('per_page', 25)));

        $notifications = Notification::query()
            ->where('notifiable_type', $request->user()->getMorphClass())
            ->where('notifiable_id', $request->user()->id)
            ->with(['dispatchJob:id,reference,title'])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($pageSize);

        $unreadCount = Notification::query()
            ->where('notifiable_type', $request->user()->getMorphClass())
            ->where('notifiable_id', $request->user()->id)
            ->where('status', '!=', 'read')
            ->whereNull('read_at')
            ->count();

        return response()->json([
            ...$notifications->toArray(),
            'has_more' => $notifications->hasMorePages(),
            'unread_count' => $unreadCount,
        ]);
    }

    public function markAsRead(Notification $notification, Request $request): RedirectResponse|JsonResponse
    {
        Gate::authorize('update', $notification);

        $notification->update([
            'status' => 'read',
            'read_at' => now(),
        ]);

        if ($request->wantsJson()) {
            return response()->json(['data' => $notification]);
        }

        return redirect()->back()->with('flash', [
            'type' => 'success',
            'message' => 'Notification marked as read.',
        ]);
    }

    public function markAllAsRead(Request $request): RedirectResponse|JsonResponse
    {
        $now = now();
        $updated = Notification::query()
            ->where('notifiable_type', $request->user()->getMorphClass())
            ->where('notifiable_id', $request->user()->id)
            ->where('status', '!=', 'read')
            ->whereNull('read_at')
            ->update([
                'status' => 'read',
                'read_at' => $now,
                'updated_at' => $now,
            ]);

        if ($request->wantsJson()) {
            return response()->json([
                'updated' => $updated,
                'unread_count' => 0,
            ]);
        }

        return redirect()->back()->with('flash', [
            'type' => 'success',
            'message' => 'All notifications marked as read.',
        ]);
    }

}
