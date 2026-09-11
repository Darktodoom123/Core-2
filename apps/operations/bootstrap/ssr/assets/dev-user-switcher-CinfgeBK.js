import { t as Button } from "./ui-CuoqGbiO.js";
import { router, usePage } from "@inertiajs/react";
import { AlertTriangle, LoaderCircle, LogIn, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
//#region resources/js/components/dev-user-switcher.tsx
function DevUserSwitcher() {
	const { is_local_env } = usePage().props;
	const [isOpen, setIsOpen] = useState(false);
	const [users, setUsers] = useState([]);
	const [isLoading, setIsLoading] = useState(false);
	const [hasLoaded, setHasLoaded] = useState(false);
	const [error, setError] = useState(null);
	const [switchingUserId, setSwitchingUserId] = useState(null);
	useEffect(() => {
		if (!isOpen) return;
		const handleKeyDown = (event) => {
			if (event.key === "Escape") setIsOpen(false);
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen]);
	useEffect(() => {
		if (!is_local_env || !isOpen || hasLoaded) return;
		const controller = new AbortController();
		fetch("/dev/users", {
			headers: { Accept: "application/json" },
			signal: controller.signal
		}).then((response) => {
			if (!response.ok) throw new Error("Unable to load development accounts.");
			return response.json();
		}).then((data) => {
			setUsers(data);
			setHasLoaded(true);
			setIsLoading(false);
		}).catch((fetchError) => {
			if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
			setError("Unable to load development accounts. Try again.");
			setIsLoading(false);
		});
		return () => controller.abort();
	}, [
		hasLoaded,
		isOpen,
		is_local_env
	]);
	if (!is_local_env) return null;
	const retry = () => {
		setError(null);
		setHasLoaded(false);
		setIsLoading(true);
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "fixed right-4 bottom-4 z-50",
		children: [isOpen && /* @__PURE__ */ jsxs("div", {
			id: "dev-user-switcher-panel",
			role: "region",
			"aria-label": "Development quick login",
			className: "mb-2 w-72 rounded-xl border border-line bg-surface p-3 shadow-xl",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "mb-3 border-b border-line px-1 pb-3",
				children: [/* @__PURE__ */ jsx("p", {
					className: "text-sm font-semibold text-ink",
					children: "Development quick login"
				}), /* @__PURE__ */ jsx("p", {
					className: "mt-1 text-xs leading-5 text-ink-soft",
					children: "Choose a seeded account to inspect its role access."
				})]
			}), /* @__PURE__ */ jsxs("div", {
				className: "max-h-64 overflow-y-auto",
				children: [
					isLoading && /* @__PURE__ */ jsxs("div", {
						className: "flex items-center gap-2 px-2 py-3 text-sm text-ink-soft",
						role: "status",
						children: [/* @__PURE__ */ jsx(LoaderCircle, {
							className: "h-4 w-4 animate-spin",
							"aria-hidden": "true"
						}), "Loading accounts..."]
					}),
					error && /* @__PURE__ */ jsxs("div", {
						className: "px-2 py-2 text-sm text-danger",
						role: "alert",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "flex items-start gap-2",
							children: [/* @__PURE__ */ jsx(AlertTriangle, {
								className: "mt-0.5 h-4 w-4 shrink-0",
								"aria-hidden": "true"
							}), /* @__PURE__ */ jsx("span", { children: error })]
						}), /* @__PURE__ */ jsx(Button, {
							size: "sm",
							variant: "quiet",
							className: "mt-2 px-0 text-danger hover:bg-transparent hover:text-danger",
							onClick: retry,
							children: "Try again"
						})]
					}),
					!isLoading && !error && users.length === 0 && /* @__PURE__ */ jsx("div", {
						className: "px-2 py-3 text-sm text-ink-soft",
						role: "status",
						children: "No active seeded accounts found."
					}),
					!isLoading && !error && users.map((user) => /* @__PURE__ */ jsxs("button", {
						type: "button",
						disabled: switchingUserId !== null,
						onClick: () => {
							setSwitchingUserId(user.id);
							router.post(`/dev/login/${user.id}`, {}, { onFinish: () => setSwitchingUserId(null) });
						},
						className: "flex min-h-11 w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-subtle focus:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-wait disabled:opacity-60",
						children: [
							/* @__PURE__ */ jsx("span", {
								className: "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-strong",
								children: user.name.split(/\s+/).map((part) => part.charAt(0)).join("").slice(0, 2).toUpperCase()
							}),
							/* @__PURE__ */ jsxs("span", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ jsx("span", {
									className: "block truncate text-sm font-medium text-ink",
									children: user.name
								}), /* @__PURE__ */ jsxs("span", {
									className: "block truncate text-xs text-ink-soft",
									children: [
										user.role_label ?? "No role",
										" ·",
										" ",
										user.email
									]
								})]
							}),
							switchingUserId === user.id ? /* @__PURE__ */ jsx(LoaderCircle, {
								className: "h-4 w-4 shrink-0 animate-spin text-ink-soft",
								"aria-label": "Switching account"
							}) : /* @__PURE__ */ jsx(LogIn, {
								className: "h-4 w-4 shrink-0 text-ink-soft",
								"aria-hidden": "true"
							})
						]
					}, user.id))
				]
			})]
		}), /* @__PURE__ */ jsx(Button, {
			size: "icon",
			"aria-expanded": isOpen,
			"aria-controls": "dev-user-switcher-panel",
			"aria-label": isOpen ? "Close quick login" : "Open quick login",
			onClick: () => {
				const nextIsOpen = !isOpen;
				setIsOpen(nextIsOpen);
				setIsLoading(nextIsOpen && !hasLoaded);
				if (nextIsOpen) setError(null);
			},
			className: "h-12 w-12 rounded-full shadow-lg",
			title: "Switch user in local development",
			children: /* @__PURE__ */ jsx(Users, {
				className: "h-5 w-5",
				"aria-hidden": "true"
			})
		})]
	});
}
//#endregion
export { DevUserSwitcher as t };

//# sourceMappingURL=dev-user-switcher-CinfgeBK.js.map