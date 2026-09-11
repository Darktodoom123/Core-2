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
        $notifications = Notification::query()
            ->where('notifiable_type', $request->user()->getMorphClass())
            ->where('notifiable_id', $request->user()->id)
            ->latest()
            ->paginate(25);

        return response()->json($notifications);
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
}
