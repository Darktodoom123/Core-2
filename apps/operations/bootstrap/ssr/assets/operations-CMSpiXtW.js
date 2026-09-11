import { a as PageHeading, c as StatusBadge, i as InlineNotice, l as ToastStack, n as DataPair, o as Panel, r as EmptyState, s as ProgressBar, t as Button, u as cn } from "./ui-CuoqGbiO.js";
import { t as DevUserSwitcher } from "./dev-user-switcher-CinfgeBK.js";
/* empty css                 */
import { Head, router, usePage } from "@inertiajs/react";
import { Activity, AlertTriangle, ArchiveRestore, ArrowRight, Bell, Bot, CalendarDays, Camera, Check, CheckCircle2, ChevronDown, ChevronRight, CircleDollarSign, CircleGauge, ClipboardCheck, ClipboardList, Clock3, CloudOff, Construction, DatabaseBackup, Download, FileText, Filter, Fuel, Gauge, Home, Layers3, LayoutDashboard, LocateFixed, LogOut, Map, MapPin, Menu, MessageSquareText, Navigation, PackageCheck, PanelLeftClose, PanelLeftOpen, Play, Plus, Route, ScanLine, Search, SearchX, Settings, ShieldCheck, Signature, SlidersHorizontal, TriangleAlert, Truck, UserCog, UserRoundCog, Users, Wrench } from "lucide-react";
import { useEffect, useMemo, useReducer, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { Circle as Circle$1, CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
//#region resources/js/types/operations.ts
var roleLabels = {
	administrator: "System Administrator",
	dispatcher: "Dispatcher",
	manager: "Operations Manager",
	driver: "Driver",
	operator: "Crane Operator",
	technician: "Field Technician"
};
//#endregion
//#region resources/js/components/app-shell.tsx
var coreModuleNavigation = [
	{
		section: "board",
		label: "Dispatch Job and Scheduling",
		icon: Gauge,
		module: 1,
		detail: "Real-time activation",
		anyPermission: ["dispatch.view_all", "dispatch.view_assigned"]
	},
	{
		section: "dispatch",
		label: "Assign Driver/Operator and Equipment",
		icon: Users,
		module: 2,
		anyPermission: ["assignments.view_all", "assignments.view_own"]
	},
	{
		section: "fleet",
		label: "Fleet Management",
		icon: Truck,
		module: 3,
		anyPermission: ["fleet.view_all", "fleet.view_assigned"]
	},
	{
		section: "equipment",
		label: "Crane and Equipment Management",
		icon: Wrench,
		module: 4,
		anyPermission: ["equipment.view_all", "equipment.view_assigned"]
	},
	{
		section: "fuel",
		label: "Fuel Management",
		icon: Fuel,
		module: 5,
		anyPermission: [
			"fuel.view_all",
			"fuel.view_own",
			"fuel.request"
		]
	}
];
var navigationByRole = {
	administrator: coreModuleNavigation,
	dispatcher: coreModuleNavigation,
	manager: coreModuleNavigation,
	driver: [
		{
			section: "today",
			label: "Today",
			icon: LayoutDashboard
		},
		{
			section: "job",
			label: "Job",
			icon: ClipboardList
		},
		{
			section: "live",
			label: "Route",
			icon: Map
		},
		{
			section: "issues",
			label: "Issues",
			icon: ShieldCheck
		}
	],
	operator: [
		{
			section: "today",
			label: "Today",
			icon: LayoutDashboard
		},
		{
			section: "job",
			label: "Job",
			icon: ClipboardList
		},
		{
			section: "tasks",
			label: "Safety",
			icon: ShieldCheck
		},
		{
			section: "issues",
			label: "Issues",
			icon: Wrench
		}
	],
	technician: [
		{
			section: "tasks",
			label: "Tasks",
			icon: ClipboardList
		},
		{
			section: "job",
			label: "Work order",
			icon: Wrench
		},
		{
			section: "equipment",
			label: "Assets",
			icon: Truck
		},
		{
			section: "issues",
			label: "Handover",
			icon: ShieldCheck
		}
	]
};
function getNavigationForRole(role, permissions = []) {
	return navigationByRole[role].filter((item) => !item.anyPermission || item.anyPermission.some((permission) => permissions.includes(permission)));
}
function AppShell({ role, section, collapsed, connectivity, queuedActions, query, onQueryChange, onSectionChange, onToggleSidebar, children }) {
	const { auth } = usePage().props;
	const navigation = getNavigationForRole(role, auth.permissions);
	const [mobileOpen, setMobileOpen] = useState(false);
	return /* @__PURE__ */ jsxs("div", {
		className: "min-h-screen bg-canvas md:grid md:grid-cols-[auto_minmax(0,1fr)]",
		children: [
			/* @__PURE__ */ jsx("a", {
				href: "#main-content",
				className: "sr-only z-50 bg-ink px-4 py-3 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2",
				children: "Skip to main content"
			}),
			mobileOpen && /* @__PURE__ */ jsx("div", {
				className: "fixed inset-0 z-40 bg-ink/20 backdrop-blur-sm md:hidden",
				onClick: () => setMobileOpen(false),
				"aria-hidden": "true"
			}),
			/* @__PURE__ */ jsxs("aside", {
				className: cn("fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-r border-white/10 bg-ink text-white transition-all duration-300 ease-in-out md:sticky md:top-0 md:translate-x-0", mobileOpen ? "translate-x-0" : "-translate-x-full", collapsed ? "md:w-[4.75rem]" : "w-[15.5rem]"),
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: cn("flex h-[4.5rem] items-center border-b border-white/10 px-4", collapsed ? "justify-center" : "gap-3"),
						children: [/* @__PURE__ */ jsx("div", {
							className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-semibold text-white",
							children: "C2"
						}), !collapsed && /* @__PURE__ */ jsxs("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ jsx("p", {
								className: "truncate text-sm font-semibold",
								children: "Core Transaction 2"
							}), /* @__PURE__ */ jsx("p", {
								className: "mt-0.5 text-xs text-white/60",
								children: "Operations platform"
							})]
						})]
					}),
					/* @__PURE__ */ jsxs("nav", {
						className: "flex-1 scrollbar-thin overflow-y-auto p-3",
						"aria-label": `${roleLabels[role]} navigation`,
						children: [!collapsed && navigation.some((item) => item.module) && /* @__PURE__ */ jsx("p", {
							className: "px-3 pb-2 text-xs font-medium text-white/50",
							children: "Core modules"
						}), /* @__PURE__ */ jsx("ul", {
							className: "space-y-1",
							children: navigation.map((item) => {
								const Icon = item.icon;
								const active = item.section === section;
								const accessibleLabel = item.module ? `Module ${item.module}: ${item.label}${item.detail ? ` (${item.detail})` : ""}` : item.label;
								return /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs("button", {
									type: "button",
									onClick: () => {
										onSectionChange(item.section);
										setMobileOpen(false);
									},
									title: collapsed ? accessibleLabel : void 0,
									"aria-label": accessibleLabel,
									className: cn("nav-btn relative flex min-h-11 w-full items-center rounded-lg py-2 text-sm transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:outline-none", collapsed ? "justify-center" : "gap-3 pr-2 pl-4", active ? "bg-white/10 text-white before:absolute before:top-1/2 before:left-0 before:h-1 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-brand before:content-['']" : "text-white/60 hover:bg-white/5 hover:text-white"),
									"aria-current": active ? "page" : void 0,
									children: [/* @__PURE__ */ jsx(Icon, {
										className: cn("shrink-0 transition-transform duration-200 ease-out motion-reduce:transform-none motion-reduce:transition-none", active && !collapsed ? "translate-x-1" : "", collapsed ? "h-[1.375rem] w-[1.375rem]" : "h-5 w-5"),
										"aria-hidden": "true"
									}), !collapsed && /* @__PURE__ */ jsxs("span", {
										className: "min-w-0 text-left",
										children: [
											item.module && /* @__PURE__ */ jsxs("span", {
												className: "block text-[0.6875rem] leading-4 font-medium text-white/50",
												children: ["Module ", item.module]
											}),
											/* @__PURE__ */ jsx("span", {
												className: cn("block leading-5", active ? "font-semibold" : "font-normal"),
												children: item.label
											}),
											item.detail && /* @__PURE__ */ jsx("span", {
												className: "block text-[0.6875rem] leading-4 text-white/50",
												children: item.detail
											})
										]
									})]
								}) }, item.section);
							})
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "border-t border-white/10 px-4 py-3",
						children: [auth.permissions.some((permission) => [
							"users.manage",
							"roles.manage",
							"system.configure"
						].includes(permission)) && /* @__PURE__ */ jsxs("button", {
							type: "button",
							onClick: () => onSectionChange("administration"),
							className: cn("flex min-h-11 w-full items-center rounded-lg text-sm text-white/60 transition-colors duration-200 ease-out hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:outline-none", collapsed ? "justify-center" : "gap-3 px-3"),
							title: collapsed ? "Settings" : void 0,
							children: [/* @__PURE__ */ jsx(Settings, {
								className: "h-[1.125rem] w-[1.125rem]",
								"aria-hidden": "true"
							}), !collapsed && /* @__PURE__ */ jsx("span", { children: "Settings" })]
						}), /* @__PURE__ */ jsxs("button", {
							type: "button",
							onClick: onToggleSidebar,
							className: cn("mt-1 flex min-h-11 w-full items-center rounded-lg text-sm text-white/60 transition-colors duration-200 ease-out hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:outline-none", collapsed ? "justify-center" : "gap-3 px-3"),
							"aria-label": collapsed ? "Expand sidebar" : "Collapse sidebar",
							children: [collapsed ? /* @__PURE__ */ jsx(PanelLeftOpen, {
								className: "h-[1.125rem] w-[1.125rem]",
								"aria-hidden": "true"
							}) : /* @__PURE__ */ jsx(PanelLeftClose, {
								className: "h-[1.125rem] w-[1.125rem]",
								"aria-hidden": "true"
							}), !collapsed && /* @__PURE__ */ jsx("span", { children: "Collapse sidebar" })]
						})]
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "min-w-0",
				children: [
					/* @__PURE__ */ jsxs("header", {
						className: "sticky top-0 z-30 flex h-[4.5rem] items-center gap-3 border-b border-line bg-surface px-5 md:px-7",
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "flex items-center gap-2 md:hidden",
								children: [
									/* @__PURE__ */ jsx("button", {
										type: "button",
										onClick: () => setMobileOpen(true),
										className: "flex h-9 w-9 items-center justify-center rounded-lg bg-surface-subtle text-ink transition-colors hover:bg-line",
										"aria-label": "Open navigation menu",
										children: /* @__PURE__ */ jsx(Menu, { className: "h-5 w-5" })
									}),
									/* @__PURE__ */ jsx("div", {
										className: "flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-xs font-semibold text-white",
										children: "C2"
									}),
									/* @__PURE__ */ jsxs("button", {
										type: "button",
										onClick: () => {
											const index = navigation.findIndex((item) => item.section === section);
											const next = navigation[(index + 1) % navigation.length];
											if (next) onSectionChange(next.section);
										},
										className: "flex h-11 min-w-0 items-center gap-1 rounded-lg px-2 text-sm font-medium hover:bg-surface-subtle",
										"aria-label": "Go to next section",
										children: [/* @__PURE__ */ jsx("span", {
											className: "max-w-32 truncate",
											children: navigation.find((item) => item.section === section)?.label ?? "Overview"
										}), /* @__PURE__ */ jsx(ChevronRight, {
											className: "h-4 w-4",
											"aria-hidden": "true"
										})]
									})
								]
							}),
							/* @__PURE__ */ jsxs("label", {
								className: "relative hidden max-w-md flex-1 lg:block",
								children: [
									/* @__PURE__ */ jsx("span", {
										className: "sr-only",
										children: "Search current workspace"
									}),
									/* @__PURE__ */ jsx(Search, {
										className: "pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted",
										"aria-hidden": "true"
									}),
									/* @__PURE__ */ jsx("input", {
										value: query,
										onChange: (event) => onQueryChange(event.target.value),
										className: "h-10 w-full rounded-lg border border-line bg-surface-subtle pr-3 pl-9 text-sm text-ink placeholder:text-ink-soft",
										placeholder: "Search jobs, assets, people…"
									})
								]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "ml-auto flex items-center gap-2",
								children: [
									/* @__PURE__ */ jsxs("div", {
										className: cn("hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium sm:flex", connectivity === "online" && "bg-success-soft text-green-800", connectivity === "offline" && "bg-warning-soft text-amber-900", connectivity === "syncing" && "bg-brand-soft text-brand-strong"),
										role: "status",
										children: [/* @__PURE__ */ jsx("span", { className: "h-1.5 w-1.5 rounded-full bg-current" }), connectivity === "online" ? "Synced" : connectivity === "offline" ? `Offline · ${queuedActions} queued` : "Syncing"]
									}),
									/* @__PURE__ */ jsxs(Button, {
										size: "icon",
										variant: "quiet",
										"aria-label": "Notifications, 3 unread",
										title: "Notifications",
										className: "relative hidden min-[400px]:inline-flex",
										children: [/* @__PURE__ */ jsx(Bell, {
											className: "h-5 w-5",
											"aria-hidden": "true"
										}), /* @__PURE__ */ jsx("span", { className: "absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-surface" })]
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "hidden min-w-0 text-right sm:block",
										children: [/* @__PURE__ */ jsx("p", {
											className: "max-w-40 truncate text-sm font-medium text-ink",
											children: auth.user?.name
										}), /* @__PURE__ */ jsx("p", {
											className: "max-w-40 truncate text-xs text-ink-soft",
											children: auth.role_label
										})]
									}),
									/* @__PURE__ */ jsx(Button, {
										size: "icon",
										variant: "quiet",
										onClick: () => router.post("/logout"),
										"aria-label": "Sign out",
										title: "Sign out",
										children: /* @__PURE__ */ jsx(LogOut, {
											className: "h-5 w-5",
											"aria-hidden": "true"
										})
									})
								]
							})
						]
					}),
					/* @__PURE__ */ jsx("main", {
						id: "main-content",
						className: "min-w-0",
						children
					}),
					/* @__PURE__ */ jsx(DevUserSwitcher, {})
				]
			})
		]
	});
}
//#endregion
//#region resources/js/components/local-operations-map.tsx
var DEFAULT_CENTER = [14.64, 121.04];
var DEFAULT_ZOOM = 11;
var destinationCoordinates = {
	"Balintawak Substation": [14.6572, 120.9847],
	"Marikina River Bridge": [14.6367, 121.1021],
	"North Yard": [14.6762, 121.0116]
};
function LocalOperationsMap({ points, selectedId, onSelect }) {
	const [showRoutes, setShowRoutes] = useState(true);
	const [showGeofences, setShowGeofences] = useState(true);
	const selected = useMemo(() => points.find((point) => point.resourceId === selectedId) ?? points[0], [points, selectedId]);
	const routePositions = useMemo(() => points.filter((point) => point.freshness !== "Offline").map(pointPosition), [points]);
	const geofenceCenters = useMemo(() => Array.from(new Set(points.map((point) => point.destination))).map((destination) => ({
		destination,
		position: destinationCoordinates[destination] ?? DEFAULT_CENTER
	})), [points]);
	return /* @__PURE__ */ jsxs("div", {
		className: "grid min-h-[34rem] grid-cols-1 border-t border-line xl:grid-cols-[minmax(0,1fr)_20rem]",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "relative min-h-[28rem] overflow-hidden bg-[#eef3f6]",
			children: [/* @__PURE__ */ jsxs(MapContainer, {
				center: DEFAULT_CENTER,
				zoom: DEFAULT_ZOOM,
				scrollWheelZoom: true,
				className: "h-full min-h-[28rem] w-full",
				"aria-label": "OpenStreetMap showing Metro Manila job sites and tracked resources",
				children: [
					/* @__PURE__ */ jsx(TileLayer, {
						url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
						attribution: "© <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors"
					}),
					/* @__PURE__ */ jsx(MapViewport, { selected }),
					/* @__PURE__ */ jsx(MapControls, {
						showRoutes,
						showGeofences,
						onToggleRoutes: () => setShowRoutes((value) => !value),
						onToggleGeofences: () => setShowGeofences((value) => !value)
					}),
					showRoutes && routePositions.length > 1 && /* @__PURE__ */ jsx(Polyline, {
						positions: routePositions,
						pathOptions: {
							color: "var(--color-brand-strong)",
							dashArray: "9 7",
							weight: 4
						}
					}),
					showGeofences && geofenceCenters.map(({ destination, position }) => /* @__PURE__ */ jsx(Circle$1, {
						center: position,
						radius: 350,
						pathOptions: {
							color: "var(--color-info)",
							fillColor: "var(--color-info)",
							fillOpacity: .08,
							weight: 1.5
						}
					}, `geofence-${destination}`)),
					points.map((point) => /* @__PURE__ */ jsx(CircleMarker, {
						center: pointPosition(point),
						radius: selected?.resourceId === point.resourceId ? 11 : 8,
						eventHandlers: { click: () => onSelect(point.resourceId) },
						pathOptions: {
							color: "var(--color-surface)",
							fillColor: markerColor(point.freshness),
							fillOpacity: point.freshness === "Offline" ? .55 : .95,
							weight: selected?.resourceId === point.resourceId ? 4 : 2
						},
						children: /* @__PURE__ */ jsxs(Popup, { children: [
							/* @__PURE__ */ jsx("strong", { children: point.label }),
							/* @__PURE__ */ jsx("br", {}),
							point.destination,
							/* @__PURE__ */ jsx("br", {}),
							point.freshness,
							" · ",
							point.updatedAt
						] })
					}, point.id))
				]
			}), /* @__PURE__ */ jsx("div", {
				className: "pointer-events-none absolute right-3 bottom-8 z-[500] rounded-lg bg-surface/95 p-3 text-xs text-ink-soft shadow-sm",
				children: /* @__PURE__ */ jsxs("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ jsx(Construction, {
						className: "h-4 w-4",
						"aria-hidden": "true"
					}), "OpenStreetMap basemap · Prototype telemetry"]
				})
			})]
		}), /* @__PURE__ */ jsxs("aside", {
			className: "max-h-[38rem] overflow-y-auto border-t border-line bg-surface xl:border-t-0 xl:border-l",
			"aria-label": "Live asset list",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "sticky top-0 z-10 border-b border-line bg-surface px-4 py-3",
					children: [/* @__PURE__ */ jsx("h3", {
						className: "font-semibold text-ink",
						children: "Tracked resources"
					}), /* @__PURE__ */ jsxs("p", {
						className: "mt-0.5 text-xs text-ink-soft",
						children: [
							points.filter((point) => point.freshness === "Live").length,
							" ",
							"live · ",
							points.length,
							" total"
						]
					})]
				}),
				/* @__PURE__ */ jsx("ul", {
					className: "divide-y divide-line",
					children: points.map((point) => {
						const Icon = point.kind === "truck" ? Truck : point.kind === "crane" ? Construction : UserRoundCog;
						return /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs("button", {
							type: "button",
							onClick: () => onSelect(point.resourceId),
							className: cn("w-full px-4 py-3 text-left hover:bg-surface-subtle", selected?.resourceId === point.resourceId && "bg-brand-soft"),
							children: [/* @__PURE__ */ jsxs("div", {
								className: "flex items-start justify-between gap-3",
								children: [/* @__PURE__ */ jsxs("div", {
									className: "flex items-start gap-2",
									children: [/* @__PURE__ */ jsx(Icon, {
										className: "mt-0.5 h-4 w-4 shrink-0 text-ink-soft",
										"aria-hidden": "true"
									}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
										className: "text-sm font-semibold text-ink",
										children: point.label
									}), /* @__PURE__ */ jsx("p", {
										className: "mt-1 text-xs text-ink-soft",
										children: point.destination
									})] })]
								}), /* @__PURE__ */ jsx(StatusBadge, { status: point.freshness })]
							}), /* @__PURE__ */ jsxs("div", {
								className: "mt-2 flex items-center justify-between gap-3 text-xs text-ink-soft",
								children: [/* @__PURE__ */ jsx("span", { children: point.eta }), /* @__PURE__ */ jsxs("span", { children: ["Updated ", point.updatedAt] })]
							})]
						}) }, point.id);
					})
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "m-4 flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-xs leading-5 text-amber-950",
					children: [/* @__PURE__ */ jsx(AlertTriangle, {
						className: "mt-0.5 h-4 w-4 shrink-0",
						"aria-hidden": "true"
					}), "Stale and offline signals remain visible so dispatchers can distinguish missing data from inactive assets."]
				})
			]
		})]
	});
}
function MapControls({ showRoutes, showGeofences, onToggleRoutes, onToggleGeofences }) {
	const map = useMap();
	return /* @__PURE__ */ jsxs("div", {
		className: "absolute top-3 left-3 z-[500] flex flex-col gap-2",
		children: [
			/* @__PURE__ */ jsx(Button, {
				size: "icon",
				variant: "secondary",
				onClick: () => map.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM),
				"aria-label": "Center the operations map",
				title: "Center map",
				children: /* @__PURE__ */ jsx(LocateFixed, {
					className: "h-4 w-4",
					"aria-hidden": "true"
				})
			}),
			/* @__PURE__ */ jsx(Button, {
				size: "icon",
				variant: showRoutes ? "primary" : "secondary",
				onClick: onToggleRoutes,
				"aria-pressed": showRoutes,
				"aria-label": "Toggle planned routes",
				title: "Planned routes",
				children: /* @__PURE__ */ jsx(Route, {
					className: "h-4 w-4",
					"aria-hidden": "true"
				})
			}),
			/* @__PURE__ */ jsx(Button, {
				size: "icon",
				variant: showGeofences ? "primary" : "secondary",
				onClick: onToggleGeofences,
				"aria-pressed": showGeofences,
				"aria-label": "Toggle job-site geofences",
				title: "Job-site geofences",
				children: /* @__PURE__ */ jsx(Layers3, {
					className: "h-4 w-4",
					"aria-hidden": "true"
				})
			})
		]
	});
}
function MapViewport({ selected }) {
	const map = useMap();
	useEffect(() => {
		if (!selected) return;
		map.flyTo(pointPosition(selected), 13, { duration: .35 });
	}, [map, selected]);
	return null;
}
function pointPosition(point) {
	const base = destinationCoordinates[point.destination] ?? [14.64, 121.04];
	const latitudeOffset = (point.y - 50) * 12e-5;
	const longitudeOffset = (point.x - 50) * 12e-5;
	return [base[0] + latitudeOffset, base[1] + longitudeOffset];
}
function markerColor(freshness) {
	switch (freshness) {
		case "Live": return "var(--color-success-strong)";
		case "Delayed": return "var(--color-warning-strong)";
		case "Stale": return "var(--color-danger)";
		case "Offline": return "var(--color-muted)";
	}
}
//#endregion
//#region resources/js/components/surfaces/dispatch-surfaces.tsx
function GuidedDispatch({ jobs, resources, proposal, selectedJobId, query, onClearQuery, onSelectJob, onResolveConflict, onConfirmDispatch }) {
	const filteredJobs = jobs.filter((job) => `${job.reference} ${job.client} ${job.title} ${job.site}`.toLowerCase().includes(query.toLowerCase()));
	const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs[0];
	const assignedCrane = resources.find((resource) => resource.id === proposal.proposedAssignment.craneId);
	const assignedOperator = resources.find((resource) => resource.id === proposal.proposedAssignment.operatorId);
	const unresolvedCount = proposal.conflicts.filter((conflict) => !conflict.resolved).length;
	const pageActions = /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs(Button, {
		variant: "secondary",
		children: [/* @__PURE__ */ jsx(MessageSquareText, {
			className: "h-4 w-4",
			"aria-hidden": "true"
		}), "Contact field team"]
	}), /* @__PURE__ */ jsx(Button, {
		variant: "primary",
		children: "Create service request"
	})] });
	if (!selectedJob) return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(PageHeading, {
		title: "Dispatch workspace",
		description: "Review the request, resolve operational conflicts, and confirm the prepared resource plan.",
		actions: pageActions
	}), /* @__PURE__ */ jsx("div", {
		className: "p-4 md:p-6",
		children: /* @__PURE__ */ jsx(Panel, { children: /* @__PURE__ */ jsx(EmptyState, {
			icon: ClipboardList,
			title: "No dispatch requests available",
			message: "New service requests and jobs will appear here when they are ready for dispatch review."
		}) })
	})] });
	return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(PageHeading, {
		title: "Dispatch workspace",
		description: "Review the request, resolve operational conflicts, and confirm the prepared resource plan.",
		actions: pageActions
	}), /* @__PURE__ */ jsxs("div", {
		className: "grid min-h-[calc(100vh-9rem)] grid-cols-1 min-[1400px]:grid-cols-[18rem_minmax(0,1fr)_22rem] lg:grid-cols-[16rem_minmax(0,1fr)]",
		children: [
			/* @__PURE__ */ jsxs("aside", {
				className: "border-b border-line bg-surface min-[1400px]:row-span-1 lg:row-span-2 lg:border-r lg:border-b-0",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-center justify-between border-b border-line px-4 py-3",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", {
						className: "text-sm font-semibold text-ink",
						children: "Request inbox"
					}), /* @__PURE__ */ jsxs("p", {
						className: "mt-0.5 text-xs text-ink-soft",
						children: [filteredJobs.length, " requests and jobs"]
					})] }), /* @__PURE__ */ jsx(Button, {
						size: "icon",
						variant: "quiet",
						"aria-label": "Filter request inbox",
						children: /* @__PURE__ */ jsx(Filter, {
							className: "h-4 w-4",
							"aria-hidden": "true"
						})
					})]
				}), filteredJobs.length === 0 ? /* @__PURE__ */ jsx(EmptyState, {
					compact: true,
					announce: true,
					icon: SearchX,
					title: "No matching requests",
					message: "Try a job reference, client, or site name.",
					primaryAction: /* @__PURE__ */ jsx(Button, {
						variant: "secondary",
						onClick: onClearQuery,
						children: "Clear workspace search"
					})
				}) : /* @__PURE__ */ jsx("ul", {
					className: "divide-y divide-line",
					children: filteredJobs.map((job) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs("button", {
						type: "button",
						onClick: () => onSelectJob(job.id),
						className: cn("w-full px-4 py-4 text-left hover:bg-surface-subtle", job.id === selectedJob.id && "bg-brand-soft"),
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "flex items-start justify-between gap-2",
								children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
									className: "text-sm font-semibold text-ink",
									children: job.reference
								}), /* @__PURE__ */ jsx("p", {
									className: "mt-1 text-sm leading-5 text-ink",
									children: job.title
								})] }), /* @__PURE__ */ jsx(StatusBadge, { status: job.priority })]
							}),
							/* @__PURE__ */ jsx("p", {
								className: "mt-2 text-xs text-ink-soft",
								children: job.client
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "mt-2 flex items-center justify-between gap-3 text-xs text-ink-soft",
								children: [/* @__PURE__ */ jsx("span", { children: job.startTime }), /* @__PURE__ */ jsx(StatusBadge, { status: job.status })]
							})
						]
					}) }, job.id))
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "min-w-0 bg-canvas p-4 md:p-5",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "mb-4 flex flex-wrap items-center justify-between gap-3",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [/* @__PURE__ */ jsx("h2", {
							className: "text-xl font-semibold tracking-[-0.02em] text-ink",
							children: selectedJob.title
						}), /* @__PURE__ */ jsx(StatusBadge, { status: selectedJob.status })]
					}), /* @__PURE__ */ jsx("span", {
						className: "text-xs text-ink-soft",
						children: "Updated two minutes ago"
					})]
				}), /* @__PURE__ */ jsxs("div", {
					className: "grid gap-4 2xl:grid-cols-[minmax(16rem,0.72fr)_minmax(24rem,1.28fr)]",
					children: [/* @__PURE__ */ jsxs(Panel, {
						className: "p-4",
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "flex items-center justify-between gap-3",
								children: [/* @__PURE__ */ jsx("h3", {
									className: "font-semibold text-ink",
									children: "Request details"
								}), /* @__PURE__ */ jsx(Button, {
									size: "sm",
									variant: "quiet",
									children: "Edit request"
								})]
							}),
							/* @__PURE__ */ jsxs("dl", {
								className: "mt-2 divide-y divide-line",
								children: [
									/* @__PURE__ */ jsx(DataPair, {
										label: "Request",
										value: selectedJob.reference
									}),
									/* @__PURE__ */ jsx(DataPair, {
										label: "Client",
										value: selectedJob.client
									}),
									/* @__PURE__ */ jsx(DataPair, {
										label: "Contact",
										value: selectedJob.contact
									}),
									/* @__PURE__ */ jsx(DataPair, {
										label: "Site",
										value: selectedJob.site
									}),
									/* @__PURE__ */ jsx(DataPair, {
										label: "Work type",
										value: selectedJob.workType
									}),
									/* @__PURE__ */ jsx(DataPair, {
										label: "Schedule",
										value: `${selectedJob.scheduledDate} · ${selectedJob.startTime}–${selectedJob.endTime}`
									})
								]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "mt-4 rounded-lg bg-surface-subtle p-3",
								children: [/* @__PURE__ */ jsx("p", {
									className: "text-xs font-semibold text-ink",
									children: "Site note"
								}), /* @__PURE__ */ jsx("p", {
									className: "mt-1 text-sm leading-5 text-ink-soft",
									children: selectedJob.siteNote
								})]
							})
						]
					}), /* @__PURE__ */ jsxs("div", {
						className: "space-y-4",
						children: [
							/* @__PURE__ */ jsxs(Panel, {
								className: "p-4",
								children: [
									/* @__PURE__ */ jsxs("div", {
										className: "flex flex-wrap items-center justify-between gap-3",
										children: [/* @__PURE__ */ jsxs("div", {
											className: "flex items-center gap-2",
											children: [/* @__PURE__ */ jsx("h3", {
												className: "font-semibold text-ink",
												children: "Suggested assignment"
											}), /* @__PURE__ */ jsxs("span", {
												className: "inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-1 text-xs font-medium text-brand-strong",
												children: [/* @__PURE__ */ jsx(Bot, {
													className: "h-3.5 w-3.5",
													"aria-hidden": "true"
												}), proposal.state === "Confirmed" ? "Human-confirmed · Applied" : "GPT draft · Not applied"]
											})]
										}), /* @__PURE__ */ jsx("span", {
											className: "text-xs text-ink-soft",
											children: proposal.generatedAt
										})]
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "mt-4 grid divide-y divide-line rounded-lg border border-line md:grid-cols-2 md:divide-x md:divide-y-0",
										children: [/* @__PURE__ */ jsxs("div", {
											className: "p-4",
											children: [
												/* @__PURE__ */ jsx("p", {
													className: "text-xs font-medium text-success",
													children: "Best equipment match"
												}),
												/* @__PURE__ */ jsxs("p", {
													className: "mt-1 font-semibold text-ink",
													children: [
														assignedCrane?.code,
														" ·",
														" ",
														assignedCrane?.name
													]
												}),
												/* @__PURE__ */ jsx("p", {
													className: "mt-1 text-sm text-ink-soft",
													children: "Available at North Yard · 6.8 km"
												})
											]
										}), /* @__PURE__ */ jsxs("div", {
											className: "p-4",
											children: [
												/* @__PURE__ */ jsx("p", {
													className: "text-xs font-medium text-success",
													children: "Qualified operator"
												}),
												/* @__PURE__ */ jsx("p", {
													className: "mt-1 font-semibold text-ink",
													children: assignedOperator?.name
												}),
												/* @__PURE__ */ jsx("p", {
													className: "mt-1 text-sm text-ink-soft",
													children: "18 comparable lifts · Certification valid"
												})
											]
										})]
									}),
									/* @__PURE__ */ jsxs(Button, {
										variant: "quiet",
										size: "sm",
										className: "mt-3",
										children: ["Compare 2 alternative matches", /* @__PURE__ */ jsx(ChevronDown, {
											className: "h-4 w-4",
											"aria-hidden": "true"
										})]
									})
								]
							}),
							/* @__PURE__ */ jsxs(Panel, {
								className: "overflow-hidden",
								children: [/* @__PURE__ */ jsxs("div", {
									className: "flex items-center justify-between gap-3 border-b border-line px-4 py-3",
									children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h3", {
										className: "font-semibold text-ink",
										children: "Schedule and conflict check"
									}), /* @__PURE__ */ jsx("p", {
										className: "mt-0.5 text-xs text-ink-soft",
										children: unresolvedCount === 0 ? "All required conflicts are resolved" : `${unresolvedCount} conflict requires review`
									})] }), unresolvedCount === 0 ? /* @__PURE__ */ jsx(CheckCircle2, {
										className: "h-5 w-5 text-success",
										"aria-label": "All conflicts resolved"
									}) : /* @__PURE__ */ jsx(AlertTriangle, {
										className: "h-5 w-5 text-warning",
										"aria-label": "Conflict requires review"
									})]
								}), /* @__PURE__ */ jsx("div", {
									className: "divide-y divide-line",
									children: proposal.conflicts.map((conflict) => /* @__PURE__ */ jsxs("div", {
										className: "grid gap-3 px-4 py-3 md:grid-cols-[10rem_1fr_auto] md:items-center",
										children: [
											/* @__PURE__ */ jsxs("div", {
												className: "flex items-center gap-2",
												children: [conflict.resolved ? /* @__PURE__ */ jsx(Check, {
													className: "h-4 w-4 text-success",
													"aria-hidden": "true"
												}) : /* @__PURE__ */ jsx(AlertTriangle, {
													className: "h-4 w-4 text-warning",
													"aria-hidden": "true"
												}), /* @__PURE__ */ jsx("span", {
													className: "text-sm font-semibold text-ink",
													children: conflict.title
												})]
											}),
											/* @__PURE__ */ jsx("p", {
												className: "text-sm leading-5 text-ink-soft",
												children: conflict.detail
											}),
											conflict.resolved ? /* @__PURE__ */ jsx(StatusBadge, { status: "Resolved" }) : /* @__PURE__ */ jsx(Button, {
												size: "sm",
												onClick: () => onResolveConflict(conflict.id),
												children: "Use 07:30 start"
											})
										]
									}, conflict.id))
								})]
							}),
							/* @__PURE__ */ jsxs(Panel, {
								className: "p-4",
								children: [/* @__PURE__ */ jsx("h3", {
									className: "font-semibold text-ink",
									children: "Why this match"
								}), /* @__PURE__ */ jsx("ul", {
									className: "mt-3 space-y-2.5",
									children: proposal.reasons.map((reason) => /* @__PURE__ */ jsxs("li", {
										className: "flex items-start gap-2 text-sm leading-5 text-ink-soft",
										children: [/* @__PURE__ */ jsx(Check, {
											className: "mt-0.5 h-4 w-4 shrink-0 text-success",
											"aria-hidden": "true"
										}), reason]
									}, reason))
								})]
							})
						]
					})]
				})]
			}),
			/* @__PURE__ */ jsxs("aside", {
				className: "border-t border-line bg-surface p-4 min-[1400px]:col-start-auto min-[1400px]:border-t-0 min-[1400px]:border-l lg:col-start-2",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "flex items-center justify-between gap-3",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ jsx(Bot, {
								className: "h-5 w-5 text-brand",
								"aria-hidden": "true"
							}), /* @__PURE__ */ jsx("h2", {
								className: "font-semibold text-ink",
								children: "Dispatch assistant"
							})]
						}), /* @__PURE__ */ jsx(StatusBadge, { status: proposal.state })]
					}),
					/* @__PURE__ */ jsx(InlineNotice, {
						tone: proposal.state === "Confirmed" ? "success" : "info",
						title: proposal.state === "Confirmed" ? "Human confirmation recorded" : "This is a draft plan",
						children: proposal.state === "Confirmed" ? "The reviewed resource plan is now scheduled and visible to the field team." : "Review the recommendation and confirm before any dispatch is scheduled."
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-5",
						children: [/* @__PURE__ */ jsx("h3", {
							className: "text-sm font-semibold text-ink",
							children: "Recommended plan"
						}), /* @__PURE__ */ jsx("p", {
							className: "mt-2 text-sm leading-6 text-ink-soft",
							children: proposal.summary
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-5",
						children: [/* @__PURE__ */ jsx("h3", {
							className: "text-sm font-semibold text-ink",
							children: "Proposed schedule"
						}), /* @__PURE__ */ jsx("ol", {
							className: "mt-3 space-y-0",
							children: [
								["06:15", "Crane clears North Yard"],
								["06:30", "Crew arrival and setup"],
								["07:30", "Start lift operation"],
								["15:30", "Complete work"],
								["16:00", "Depart site"]
							].map(([time, event], index, events) => /* @__PURE__ */ jsxs("li", {
								className: "grid grid-cols-[3.25rem_1rem_1fr] gap-2 text-xs",
								children: [
									/* @__PURE__ */ jsx("span", {
										className: "py-2 font-medium text-ink",
										children: time
									}),
									/* @__PURE__ */ jsxs("span", {
										className: "relative flex justify-center",
										children: [index < events.length - 1 && /* @__PURE__ */ jsx("span", { className: "absolute top-3 bottom-0 w-px bg-line-strong" }), /* @__PURE__ */ jsx("span", { className: "relative mt-2.5 h-2 w-2 rounded-full bg-ink" })]
									}),
									/* @__PURE__ */ jsx("span", {
										className: "py-2 text-ink-soft",
										children: event
									})
								]
							}, time))
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-5 border-t border-line pt-4",
						children: [/* @__PURE__ */ jsx("h3", {
							className: "text-sm font-semibold text-ink",
							children: "Assumptions"
						}), /* @__PURE__ */ jsx("ul", {
							className: "mt-2 space-y-2 text-xs leading-5 text-ink-soft",
							children: proposal.assumptions.map((assumption) => /* @__PURE__ */ jsxs("li", { children: ["• ", assumption] }, assumption))
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-5 space-y-2",
						children: [
							/* @__PURE__ */ jsx(Button, {
								className: "w-full",
								variant: "secondary",
								children: "Review change summary"
							}),
							/* @__PURE__ */ jsx(Button, {
								className: "w-full",
								variant: "primary",
								onClick: () => onConfirmDispatch(selectedJob.id),
								disabled: proposal.state === "Confirmed",
								children: proposal.state === "Confirmed" ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(Check, {
									className: "h-4 w-4",
									"aria-hidden": "true"
								}), "Dispatch confirmed"] }) : /* @__PURE__ */ jsxs(Fragment, { children: ["Confirm dispatch", /* @__PURE__ */ jsx(ArrowRight, {
									className: "h-4 w-4",
									"aria-hidden": "true"
								})] })
							}),
							/* @__PURE__ */ jsxs("p", {
								className: "flex items-center justify-center gap-1.5 text-center text-xs text-ink-soft",
								children: [/* @__PURE__ */ jsx(ShieldCheck, {
									className: "h-3.5 w-3.5",
									"aria-hidden": "true"
								}), proposal.state === "Confirmed" ? "Human confirmation recorded" : "Human confirmation required"]
							})
						]
					})
				]
			})
		]
	})] });
}
var boardRows = [
	{
		resourceId: "cr-220-01",
		category: "Cranes"
	},
	{
		resourceId: "cr-250-04",
		category: "Cranes"
	},
	{
		resourceId: "cr-160-02",
		category: "Cranes"
	},
	{
		resourceId: "cr-110-03",
		category: "Cranes"
	},
	{
		resourceId: "tr-01",
		category: "Trucks"
	},
	{
		resourceId: "tr-02",
		category: "Trucks"
	},
	{
		resourceId: "tr-03",
		category: "Trucks"
	},
	{
		resourceId: "eq-ml-01",
		category: "Support equipment"
	}
];
function boardPosition(job) {
	const [hour = 7, minutes = 0] = job.startTime.split(":").map(Number);
	const [endHour = hour + 2, endMinutes = 0] = job.endTime.split(":").map(Number);
	const start = Math.max(0, (hour - 7) * 60 + minutes);
	const duration = Math.max(90, (endHour - hour) * 60 + endMinutes - minutes);
	return {
		left: `${start / 660 * 100}%`,
		width: `${Math.min(duration / 660 * 100, 100 - start / 660 * 100)}%`
	};
}
function DispatchBoard({ jobs, resources, selectedJobId, query, onClearQuery, onSelectJob }) {
	const [conflictsOnly, setConflictsOnly] = useState(false);
	const filteredJobs = jobs.filter((job) => `${job.reference} ${job.title} ${job.client}`.toLowerCase().includes(query.toLowerCase()));
	const categories = Array.from(new Set(boardRows.map((row) => row.category)));
	const boardResourceIds = new Set(boardRows.map((row) => row.resourceId));
	const hasVisibleJobs = filteredJobs.some((job) => (!conflictsOnly || job.reference === "CON-1256") && Object.values(job.assignment).some((value) => Array.isArray(value) ? value.some((resourceId) => boardResourceIds.has(resourceId)) : boardResourceIds.has(value)));
	const clearBoardFilters = () => {
		setConflictsOnly(false);
		onClearQuery();
	};
	return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(PageHeading, {
		title: "Dispatch board",
		description: "Coordinate cranes, trucks, and support equipment against today’s operating windows.",
		actions: /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs(Button, {
			variant: "secondary",
			children: [/* @__PURE__ */ jsx(CalendarDays, {
				className: "h-4 w-4",
				"aria-hidden": "true"
			}), "July 17, 2026"]
		}), /* @__PURE__ */ jsxs(Button, {
			variant: conflictsOnly ? "primary" : "secondary",
			onClick: () => setConflictsOnly((value) => !value),
			"aria-pressed": conflictsOnly,
			children: [/* @__PURE__ */ jsx(AlertTriangle, {
				className: "h-4 w-4",
				"aria-hidden": "true"
			}), "Conflicts only"]
		})] })
	}), /* @__PURE__ */ jsx("div", {
		className: "overflow-x-auto p-4 md:p-6",
		children: /* @__PURE__ */ jsxs(Panel, {
			className: "min-w-[68rem] overflow-hidden",
			children: [
				(query || conflictsOnly) && !hasVisibleJobs && /* @__PURE__ */ jsx(EmptyState, {
					compact: true,
					announce: true,
					icon: SearchX,
					className: "border-b border-line",
					title: "No jobs match the board filters",
					message: "Clear the workspace search and conflict filter to restore scheduled work.",
					primaryAction: /* @__PURE__ */ jsx(Button, {
						variant: "secondary",
						onClick: clearBoardFilters,
						children: "Clear board filters"
					})
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "grid grid-cols-[15rem_minmax(52rem,1fr)] border-b border-line bg-surface-subtle",
					children: [/* @__PURE__ */ jsx("div", {
						className: "border-r border-line px-4 py-3 text-sm font-semibold text-ink",
						children: "Resources"
					}), /* @__PURE__ */ jsx("div", {
						className: "grid grid-cols-11",
						children: Array.from({ length: 11 }, (_, index) => /* @__PURE__ */ jsx("div", {
							className: "border-r border-line px-2 py-3 text-center text-xs text-ink-soft last:border-r-0",
							children: index + 7 > 12 ? `${index - 5} PM` : `${index + 7} AM`
						}, index))
					})]
				}),
				categories.map((category) => /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("div", {
					className: "grid grid-cols-[15rem_minmax(52rem,1fr)] border-b border-line bg-canvas",
					children: [/* @__PURE__ */ jsx("div", {
						className: "px-4 py-2 text-xs font-semibold text-ink-soft",
						children: category
					}), /* @__PURE__ */ jsx("div", {})]
				}), boardRows.filter((row) => row.category === category).map((row) => {
					const resource = resources.find((item) => item.id === row.resourceId);
					const rowJobs = filteredJobs.filter((job) => Object.values(job.assignment).some((value) => Array.isArray(value) ? value.includes(row.resourceId) : value === row.resourceId));
					return /* @__PURE__ */ jsxs("div", {
						className: "grid min-h-[4.75rem] grid-cols-[15rem_minmax(52rem,1fr)] border-b border-line last:border-b-0",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "flex items-center justify-between gap-3 border-r border-line px-4 py-2",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ jsx("p", {
									className: "truncate text-sm font-semibold text-ink",
									children: resource?.code
								}), /* @__PURE__ */ jsx("p", {
									className: "mt-0.5 truncate text-xs text-ink-soft",
									children: resource?.name
								})]
							}), resource && /* @__PURE__ */ jsx(StatusBadge, { status: resource.status })]
						}), /* @__PURE__ */ jsx("div", {
							className: "relative bg-[linear-gradient(to_right,var(--color-line)_1px,transparent_1px)] bg-[length:9.09%_100%]",
							children: rowJobs.map((job) => {
								const conflict = job.reference === "CON-1256";
								if (conflictsOnly && !conflict) return null;
								return /* @__PURE__ */ jsxs("button", {
									type: "button",
									style: boardPosition(job),
									onClick: () => onSelectJob(job.id),
									className: cn("absolute top-2 bottom-2 min-w-24 overflow-hidden rounded-lg border px-2 py-1.5 text-left", job.id === selectedJobId ? "border-brand bg-brand-soft ring-2 ring-brand/20" : "border-blue-200 bg-blue-50 hover:border-brand", conflict && "border-amber-400 bg-warning-soft"),
									"aria-label": `${job.reference}, ${job.title}, ${job.startTime} to ${job.endTime}`,
									children: [/* @__PURE__ */ jsx("span", {
										className: "block truncate text-xs font-semibold text-ink",
										children: job.reference
									}), /* @__PURE__ */ jsxs("span", {
										className: "mt-0.5 block truncate text-[0.6875rem] text-ink-soft",
										children: [
											job.startTime,
											"–",
											job.endTime
										]
									})]
								}, job.id);
							})
						})]
					}, row.resourceId);
				})] }, category)),
				/* @__PURE__ */ jsxs("div", {
					className: "flex flex-wrap items-center gap-4 border-t border-line bg-surface-subtle px-4 py-3 text-xs text-ink-soft",
					children: [
						/* @__PURE__ */ jsxs("span", {
							className: "flex items-center gap-1.5",
							children: [/* @__PURE__ */ jsx("span", { className: "h-2.5 w-2.5 rounded-sm border border-blue-300 bg-blue-50" }), "Assigned"]
						}),
						/* @__PURE__ */ jsxs("span", {
							className: "flex items-center gap-1.5",
							children: [/* @__PURE__ */ jsx("span", { className: "h-2.5 w-2.5 rounded-sm border border-amber-400 bg-warning-soft" }), "Conflict"]
						}),
						/* @__PURE__ */ jsx("span", {
							className: "ml-auto",
							children: "Select a job to open its assignment workspace"
						})
					]
				})
			]
		})
	})] });
}
function LiveOperations({ telemetry, selectedAssetId, onSelectAsset }) {
	const exceptionCount = telemetry.filter((point) => point.freshness !== "Live").length;
	return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(PageHeading, {
		title: "Live operations",
		description: "Monitor routes, job-site geofences, signal freshness, and field exceptions from one operational view.",
		actions: /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs(Button, {
			variant: "secondary",
			children: [/* @__PURE__ */ jsx(Route, {
				className: "h-4 w-4",
				"aria-hidden": "true"
			}), "Route options"]
		}), /* @__PURE__ */ jsxs(Button, {
			variant: "primary",
			children: [
				/* @__PURE__ */ jsx(AlertTriangle, {
					className: "h-4 w-4",
					"aria-hidden": "true"
				}),
				"Review ",
				exceptionCount,
				" exceptions"
			]
		})] })
	}), /* @__PURE__ */ jsx("div", {
		className: "p-4 md:p-6",
		children: /* @__PURE__ */ jsx(Panel, {
			className: "overflow-hidden",
			children: telemetry.length === 0 ? /* @__PURE__ */ jsx(EmptyState, {
				icon: Route,
				title: "No live telemetry available",
				message: "Asset positions and signal freshness will appear after telemetry is received."
			}) : /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap items-center justify-between gap-3 px-4 py-3",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ jsx("span", { className: "h-2 w-2 rounded-full bg-success" }), /* @__PURE__ */ jsx("span", {
						className: "text-sm font-semibold text-ink",
						children: "Prototype telemetry is updating"
					})]
				}), /* @__PURE__ */ jsx("p", {
					className: "text-xs text-ink-soft",
					children: "Last simulation tick · 10:14:32"
				})]
			}), /* @__PURE__ */ jsx(LocalOperationsMap, {
				points: telemetry,
				selectedId: selectedAssetId,
				onSelect: onSelectAsset
			})] })
		})
	})] });
}
//#endregion
//#region resources/js/components/surfaces/management-surfaces.tsx
var prototypeUsers = [
	{
		name: "Marco Villanueva",
		email: "marco@ctms.example",
		role: "Dispatcher",
		status: "Active",
		lastSeen: "Now"
	},
	{
		name: "Dianne Santos",
		email: "dianne@ctms.example",
		role: "Operations Manager",
		status: "Active",
		lastSeen: "4 min ago"
	},
	{
		name: "Luis Ramos",
		email: "luis@ctms.example",
		role: "Driver",
		status: "Active",
		lastSeen: "7 min ago"
	},
	{
		name: "Mika Williams",
		email: "mika@ctms.example",
		role: "Crane Operator",
		status: "Active",
		lastSeen: "12 min ago"
	},
	{
		name: "Ana Dizon",
		email: "ana@ctms.example",
		role: "Field Technician",
		status: "Invited",
		lastSeen: "Invitation sent"
	}
];
function AdministratorOverview({ resources, auditEvents, onNavigate }) {
	const attention = resources.filter((resource) => resource.status === "Maintenance" || resource.status === "Offline");
	return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(PageHeading, {
		title: "System overview",
		description: "Maintain platform access, registry quality, integration health, and recoverability.",
		actions: /* @__PURE__ */ jsxs(Button, {
			variant: "primary",
			children: [/* @__PURE__ */ jsx(UserCog, {
				className: "h-4 w-4",
				"aria-hidden": "true"
			}), "Invite user"]
		})
	}), /* @__PURE__ */ jsxs("div", {
		className: "grid gap-4 p-4 md:p-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "space-y-4",
			children: [/* @__PURE__ */ jsxs(Panel, {
				className: "overflow-hidden",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-center justify-between gap-3 border-b border-line px-4 py-3",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", {
						className: "font-semibold text-ink",
						children: "Platform health"
					}), /* @__PURE__ */ jsx("p", {
						className: "mt-0.5 text-xs text-ink-soft",
						children: "Last checked two minutes ago"
					})] }), /* @__PURE__ */ jsx(StatusBadge, { status: "Operational" })]
				}), /* @__PURE__ */ jsx("div", {
					className: "divide-y divide-line",
					children: [
						[
							"Laravel application",
							"Operational",
							"36 ms"
						],
						[
							"Queue processing",
							"Operational",
							"0 pending"
						],
						[
							"GPS simulation",
							"Operational",
							"5 assets"
						],
						[
							"GPT Mini prototype",
							"Prototype",
							"Local draft"
						],
						[
							"Nightly backup",
							"Verified",
							"Today, 02:12"
						]
					].map(([service, status, detail]) => /* @__PURE__ */ jsxs("div", {
						className: "grid gap-2 px-4 py-3 text-sm sm:grid-cols-[1fr_9rem_8rem] sm:items-center",
						children: [
							/* @__PURE__ */ jsx("span", {
								className: "font-medium text-ink",
								children: service
							}),
							/* @__PURE__ */ jsx(StatusBadge, { status }),
							/* @__PURE__ */ jsx("span", {
								className: "text-ink-soft sm:text-right",
								children: detail
							})
						]
					}, service))
				})]
			}), /* @__PURE__ */ jsxs(Panel, {
				className: "overflow-hidden",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "flex items-center justify-between gap-3 border-b border-line px-4 py-3",
						children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", {
							className: "font-semibold text-ink",
							children: "Registry readiness"
						}), /* @__PURE__ */ jsx("p", {
							className: "mt-0.5 text-xs text-ink-soft",
							children: "Documents, certifications, and service state"
						})] }), /* @__PURE__ */ jsx(Button, {
							size: "sm",
							onClick: () => onNavigate("equipment"),
							children: "Open registries"
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "grid gap-5 p-4 sm:grid-cols-3",
						children: [
							/* @__PURE__ */ jsx(ProgressBar, {
								value: 94,
								label: "Fleet records"
							}),
							/* @__PURE__ */ jsx(ProgressBar, {
								value: 91,
								label: "Crane records"
							}),
							/* @__PURE__ */ jsx(ProgressBar, {
								value: 87,
								label: "People credentials"
							})
						]
					}),
					/* @__PURE__ */ jsx("div", {
						className: "border-t border-line px-4 py-3 text-sm text-ink-soft",
						children: attention.length === 0 ? "No resources are currently marked offline or in maintenance." : `${attention.length} resources require administrative attention.`
					})
				]
			})]
		}), /* @__PURE__ */ jsxs(Panel, {
			className: "self-start overflow-hidden",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "border-b border-line px-4 py-3",
				children: [/* @__PURE__ */ jsx("h2", {
					className: "font-semibold text-ink",
					children: "Recent administrative activity"
				}), /* @__PURE__ */ jsx("p", {
					className: "mt-0.5 text-xs text-ink-soft",
					children: "Auditable changes across the platform"
				})]
			}), auditEvents.length === 0 ? /* @__PURE__ */ jsx(EmptyState, {
				compact: true,
				icon: Activity,
				title: "No administrative activity recorded",
				message: "Auditable platform and access changes will appear here."
			}) : /* @__PURE__ */ jsx("ol", {
				className: "divide-y divide-line",
				children: auditEvents.slice(0, 5).map((event) => /* @__PURE__ */ jsx("li", {
					className: "px-4 py-3",
					children: /* @__PURE__ */ jsxs("div", {
						className: "flex items-start gap-3",
						children: [/* @__PURE__ */ jsx("div", {
							className: "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-ink-soft",
							children: /* @__PURE__ */ jsx(Activity, {
								className: "h-4 w-4",
								"aria-hidden": "true"
							})
						}), /* @__PURE__ */ jsxs("div", {
							className: "min-w-0",
							children: [
								/* @__PURE__ */ jsx("p", {
									className: "text-sm font-medium text-ink",
									children: event.action
								}),
								/* @__PURE__ */ jsx("p", {
									className: "mt-1 text-xs leading-5 text-ink-soft",
									children: event.detail
								}),
								/* @__PURE__ */ jsxs("p", {
									className: "mt-1 text-xs text-muted",
									children: [
										event.actor,
										" ·",
										" ",
										event.timestamp
									]
								})
							]
						})]
					})
				}, event.id))
			})]
		})]
	})] });
}
function AdministrationSurface() {
	const [tab, setTab] = useState("users");
	return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(PageHeading, {
		title: "Users & platform settings",
		description: "Control access, dispatch policies, notifications, GPS retention, and prototype permissions.",
		actions: /* @__PURE__ */ jsxs(Button, {
			variant: "primary",
			children: [/* @__PURE__ */ jsx(UserCog, {
				className: "h-4 w-4",
				"aria-hidden": "true"
			}), "Invite user"]
		})
	}), /* @__PURE__ */ jsxs("div", {
		className: "p-4 md:p-6",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "mb-4 flex gap-1 rounded-lg bg-surface-subtle p-1 sm:w-fit",
			children: [/* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: () => setTab("users"),
				className: `min-h-10 flex-1 rounded-md px-4 text-sm font-medium sm:flex-none ${tab === "users" ? "bg-surface text-ink shadow-sm" : "text-ink-soft"}`,
				children: "Users and roles"
			}), /* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: () => setTab("rules"),
				className: `min-h-10 flex-1 rounded-md px-4 text-sm font-medium sm:flex-none ${tab === "rules" ? "bg-surface text-ink shadow-sm" : "text-ink-soft"}`,
				children: "Operational rules"
			})]
		}), tab === "users" ? /* @__PURE__ */ jsx(Panel, {
			className: "overflow-hidden",
			children: /* @__PURE__ */ jsx("div", {
				className: "overflow-x-auto",
				children: /* @__PURE__ */ jsxs("table", {
					className: "w-full min-w-[46rem] text-left",
					children: [/* @__PURE__ */ jsx("thead", {
						className: "bg-surface-subtle text-xs text-ink-soft",
						children: /* @__PURE__ */ jsxs("tr", { children: [
							/* @__PURE__ */ jsx("th", {
								className: "px-4 py-3 font-medium",
								children: "User"
							}),
							/* @__PURE__ */ jsx("th", {
								className: "px-4 py-3 font-medium",
								children: "Role"
							}),
							/* @__PURE__ */ jsx("th", {
								className: "px-4 py-3 font-medium",
								children: "Status"
							}),
							/* @__PURE__ */ jsx("th", {
								className: "px-4 py-3 font-medium",
								children: "Last active"
							}),
							/* @__PURE__ */ jsx("th", {
								className: "px-4 py-3 font-medium",
								children: "Access"
							})
						] })
					}), /* @__PURE__ */ jsx("tbody", {
						className: "divide-y divide-line",
						children: prototypeUsers.map((user) => /* @__PURE__ */ jsxs("tr", { children: [
							/* @__PURE__ */ jsxs("td", {
								className: "px-4 py-3",
								children: [/* @__PURE__ */ jsx("p", {
									className: "text-sm font-semibold text-ink",
									children: user.name
								}), /* @__PURE__ */ jsx("p", {
									className: "mt-0.5 text-xs text-ink-soft",
									children: user.email
								})]
							}),
							/* @__PURE__ */ jsx("td", {
								className: "px-4 py-3 text-sm text-ink-soft",
								children: user.role
							}),
							/* @__PURE__ */ jsx("td", {
								className: "px-4 py-3",
								children: /* @__PURE__ */ jsx(StatusBadge, { status: user.status })
							}),
							/* @__PURE__ */ jsx("td", {
								className: "px-4 py-3 text-sm text-ink-soft",
								children: user.lastSeen
							}),
							/* @__PURE__ */ jsx("td", {
								className: "px-4 py-3",
								children: /* @__PURE__ */ jsx(Button, {
									size: "sm",
									variant: "quiet",
									children: "Manage access"
								})
							})
						] }, user.email))
					})]
				})
			})
		}) : /* @__PURE__ */ jsxs("div", {
			className: "grid gap-4 xl:grid-cols-2",
			children: [/* @__PURE__ */ jsxs(Panel, {
				className: "p-5",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ jsx(Gauge, {
						className: "h-5 w-5 text-brand",
						"aria-hidden": "true"
					}), /* @__PURE__ */ jsx("h2", {
						className: "font-semibold text-ink",
						children: "Dispatch controls"
					})]
				}), /* @__PURE__ */ jsx("div", {
					className: "mt-4 divide-y divide-line",
					children: [
						["Require manager approval for emergency overrides", true],
						["Allow GPT to prepare assignment changes", true],
						["Allow GPT to apply changes automatically", false]
					].map(([label, checked]) => /* @__PURE__ */ jsxs("label", {
						className: "flex min-h-14 items-center justify-between gap-4 py-3 text-sm text-ink",
						children: [/* @__PURE__ */ jsx("span", { children: String(label) }), /* @__PURE__ */ jsx("input", {
							type: "checkbox",
							defaultChecked: Boolean(checked),
							className: "h-5 w-5 accent-brand"
						})]
					}, String(label)))
				})]
			}), /* @__PURE__ */ jsxs(Panel, {
				className: "p-5",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "flex items-center gap-3",
						children: [/* @__PURE__ */ jsx(MapPin, {
							className: "h-5 w-5 text-brand",
							"aria-hidden": "true"
						}), /* @__PURE__ */ jsx("h2", {
							className: "font-semibold text-ink",
							children: "GPS and notifications"
						})]
					}),
					/* @__PURE__ */ jsxs("dl", {
						className: "mt-4 divide-y divide-line",
						children: [
							/* @__PURE__ */ jsx(DataPair, {
								label: "GPS retention",
								value: "90 days"
							}),
							/* @__PURE__ */ jsx(DataPair, {
								label: "Stale threshold",
								value: "10 minutes"
							}),
							/* @__PURE__ */ jsx(DataPair, {
								label: "Emergency alerts",
								value: "Push, email, and SMS"
							}),
							/* @__PURE__ */ jsx(DataPair, {
								label: "Field sharing",
								value: "Active assignments only"
							})
						]
					}),
					/* @__PURE__ */ jsx(Button, {
						className: "mt-4",
						variant: "secondary",
						children: "Edit GPS policy"
					})
				]
			})]
		})]
	})] });
}
function ManagerOverview({ jobs, fuelRequests, onNavigate }) {
	const activeJobs = jobs.filter((job) => [
		"Dispatched",
		"En route",
		"Arrived",
		"In progress"
	].includes(job.status));
	const pendingFuel = fuelRequests.filter((request) => request.status === "Pending");
	return /* @__PURE__ */ jsxs("div", {
		className: "relative isolate min-h-full",
		children: [
			/* @__PURE__ */ jsx("div", {
				className: "pointer-events-none absolute inset-x-0 top-0 -z-10 flex transform-gpu overflow-hidden opacity-30",
				"aria-hidden": "true",
				children: /* @__PURE__ */ jsx("div", { className: "ml-[calc(50%-20rem)] aspect-[1155/678] w-[72.1875rem] bg-gradient-to-tr from-brand to-brand-soft opacity-40 blur-[100px]" })
			}),
			/* @__PURE__ */ jsx(PageHeading, {
				title: "Operations overview",
				description: "Focus on exceptions, approvals, resource pressure, and today’s work in motion.",
				actions: /* @__PURE__ */ jsxs(Button, {
					variant: "primary",
					onClick: () => onNavigate("live"),
					children: ["Open live operations", /* @__PURE__ */ jsx(ChevronRight, {
						className: "h-4 w-4",
						"aria-hidden": "true"
					})]
				})
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid gap-6 p-4 md:p-6 xl:grid-cols-[1.5fr_1fr]",
				children: [/* @__PURE__ */ jsx("div", {
					className: "space-y-6",
					children: /* @__PURE__ */ jsxs("div", {
						className: "relative overflow-hidden rounded-lg bg-surface p-6 shadow-sm ring-1 ring-line",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "flex flex-col justify-between gap-6 border-b border-line pb-8 sm:flex-row sm:items-end",
							children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", {
								className: "text-sm font-semibold tracking-widest text-muted uppercase",
								children: "Active Operations"
							}), /* @__PURE__ */ jsxs("div", {
								className: "mt-2 flex items-baseline gap-2",
								children: [/* @__PURE__ */ jsx("span", {
									className: "text-6xl font-light tracking-tighter text-ink",
									children: activeJobs.length
								}), /* @__PURE__ */ jsxs("span", {
									className: "text-lg font-medium text-ink-soft",
									children: [
										"/ ",
										jobs.length,
										" total"
									]
								})]
							})] }), /* @__PURE__ */ jsx(Button, {
								size: "sm",
								variant: "secondary",
								onClick: () => onNavigate("board"),
								className: "shrink-0 rounded-full",
								children: "View full schedule"
							})]
						}), /* @__PURE__ */ jsx("div", {
							className: "space-y-3 pt-6",
							children: jobs.length === 0 ? /* @__PURE__ */ jsx(EmptyState, {
								compact: true,
								icon: Activity,
								title: "No scheduled operations",
								message: "Scheduled jobs will appear here when work is ready for coordination."
							}) : jobs.map((job) => /* @__PURE__ */ jsxs("button", {
								type: "button",
								onClick: () => onNavigate("board"),
								className: "group relative flex w-full flex-col justify-between gap-4 rounded-lg p-4 text-left transition-all duration-300 hover:bg-surface-subtle hover:shadow-sm focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:outline-none sm:flex-row sm:items-center",
								children: [
									[
										"In progress",
										"Dispatched",
										"En route"
									].includes(job.status) && /* @__PURE__ */ jsx("div", { className: "absolute top-3 bottom-3 left-0 hidden w-1 rounded-r-full bg-brand opacity-0 transition-opacity group-hover:opacity-100 sm:block" }),
									/* @__PURE__ */ jsxs("div", {
										className: "flex min-w-0 flex-1 items-center gap-4 sm:gap-6",
										children: [
											/* @__PURE__ */ jsxs("div", {
												className: "w-24 shrink-0 text-left sm:text-right",
												children: [/* @__PURE__ */ jsx("p", {
													className: "text-sm font-semibold text-ink transition-colors group-hover:text-brand",
													children: job.reference
												}), /* @__PURE__ */ jsxs("p", {
													className: "mt-1 text-xs text-muted",
													children: [
														job.startTime,
														"–",
														job.endTime
													]
												})]
											}),
											/* @__PURE__ */ jsx("div", { className: "hidden h-10 w-px shrink-0 bg-line sm:block" }),
											/* @__PURE__ */ jsxs("div", {
												className: "min-w-0 flex-1",
												children: [/* @__PURE__ */ jsx("p", {
													className: "truncate text-base font-medium text-ink",
													children: job.title
												}), /* @__PURE__ */ jsxs("p", {
													className: "mt-1 flex items-center gap-1 truncate text-xs text-muted",
													children: [/* @__PURE__ */ jsx(MapPin, { className: "h-3 w-3 shrink-0" }), /* @__PURE__ */ jsx("span", {
														className: "truncate",
														children: job.site
													})]
												})]
											})
										]
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "flex shrink-0 flex-row items-center gap-2 sm:flex-col sm:items-end",
										children: [/* @__PURE__ */ jsx(StatusBadge, { status: job.priority }), /* @__PURE__ */ jsx(StatusBadge, { status: job.status })]
									})
								]
							}, job.id))
						})]
					})
				}), /* @__PURE__ */ jsxs("div", {
					className: "space-y-6",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "rounded-lg bg-surface p-6 shadow-sm ring-1 ring-line",
							children: [
								/* @__PURE__ */ jsx("h2", {
									className: "text-sm font-semibold tracking-widest text-muted uppercase",
									children: "Resource Pressure"
								}),
								/* @__PURE__ */ jsx("p", {
									className: "mt-1 text-xs text-muted",
									children: "Rolling 30-day utilization"
								}),
								/* @__PURE__ */ jsx("div", {
									className: "mt-6 grid gap-5",
									children: [
										{
											label: "Cranes & equipment",
											value: 78
										},
										{
											label: "Fleet",
											value: 80
										},
										{
											label: "Field workforce",
											value: 82
										}
									].map((stat) => /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("div", {
										className: "mb-2 flex justify-between text-sm",
										children: [/* @__PURE__ */ jsx("span", {
											className: "font-medium text-ink",
											children: stat.label
										}), /* @__PURE__ */ jsxs("span", {
											className: "text-muted",
											children: [stat.value, "%"]
										})]
									}), /* @__PURE__ */ jsx("div", {
										className: "h-2 w-full overflow-hidden rounded-full bg-line",
										children: /* @__PURE__ */ jsx("div", {
											className: "h-full rounded-full bg-brand transition-all duration-1000 ease-out",
											style: { width: `${stat.value}%` }
										})
									})] }, stat.label))
								})
							]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "rounded-lg bg-surface p-6 shadow-sm ring-1 ring-line",
							children: [/* @__PURE__ */ jsx("h2", {
								className: "mb-6 text-sm font-semibold tracking-widest text-muted uppercase",
								children: "Action Required"
							}), /* @__PURE__ */ jsxs("div", {
								className: "space-y-4",
								children: [/* @__PURE__ */ jsxs("button", {
									type: "button",
									onClick: () => onNavigate("fuel"),
									className: "group flex w-full items-start gap-4 rounded-lg border border-line p-4 text-left transition-all hover:border-warning hover:shadow-sm focus-visible:ring-2 focus-visible:ring-warning/50 focus-visible:outline-none",
									children: [/* @__PURE__ */ jsx("div", {
										className: "rounded-full bg-warning-soft p-2 text-warning transition-transform group-hover:scale-110",
										children: /* @__PURE__ */ jsx(Fuel, { className: "h-5 w-5" })
									}), /* @__PURE__ */ jsxs("div", {
										className: "flex-1",
										children: [/* @__PURE__ */ jsxs("p", {
											className: "text-sm font-semibold text-ink transition-colors",
											children: [pendingFuel.length, " fuel request awaiting approval"]
										}), /* @__PURE__ */ jsx("p", {
											className: "mt-1 text-xs text-muted",
											children: "Earliest request: Today, 09:18"
										})]
									})]
								}), /* @__PURE__ */ jsxs("button", {
									type: "button",
									onClick: () => onNavigate("dispatch"),
									className: "group flex w-full items-start gap-4 rounded-lg border border-line p-4 text-left transition-all hover:border-danger hover:shadow-sm focus-visible:ring-2 focus-visible:ring-danger/50 focus-visible:outline-none",
									children: [/* @__PURE__ */ jsx("div", {
										className: "rounded-full bg-danger-soft p-2 text-danger transition-transform group-hover:scale-110",
										children: /* @__PURE__ */ jsx(AlertTriangle, { className: "h-5 w-5" })
									}), /* @__PURE__ */ jsxs("div", {
										className: "flex-1",
										children: [/* @__PURE__ */ jsx("p", {
											className: "text-sm font-semibold text-ink transition-colors",
											children: "Emergency dispatch override"
										}), /* @__PURE__ */ jsx("p", {
											className: "mt-1 text-xs text-muted",
											children: "CON-1256 · Traffic support added"
										})]
									})]
								})]
							})]
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => onNavigate("board"),
							className: "group w-full rounded-lg text-left focus-visible:ring-2 focus-visible:ring-warning/50 focus-visible:outline-none",
							children: /* @__PURE__ */ jsx(InlineNotice, {
								tone: "warning",
								title: "Maintenance risk",
								children: "TR-03 is overdue for preventive service and remains active on CON-1248. Confirm its return-to-yard time."
							})
						})
					]
				})]
			})
		]
	});
}
function ReportsSurface({ resources, auditEvents, administrator = false }) {
	const [restoreArmed, setRestoreArmed] = useState(false);
	return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(PageHeading, {
		title: administrator ? "Audit & backups" : "Performance reports",
		description: administrator ? "Review sensitive changes and confirm that recovery data remains usable." : "Compare dispatch reliability, utilization, safety completion, and fuel performance.",
		actions: /* @__PURE__ */ jsxs(Button, {
			variant: "secondary",
			children: [/* @__PURE__ */ jsx(Download, {
				className: "h-4 w-4",
				"aria-hidden": "true"
			}), "Export report"]
		})
	}), /* @__PURE__ */ jsxs("div", {
		className: "grid gap-4 p-4 md:p-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "space-y-4",
			children: [!administrator && /* @__PURE__ */ jsxs(Panel, {
				className: "p-5",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-center justify-between gap-3",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", {
						className: "font-semibold text-ink",
						children: "Seven-day equipment utilization"
					}), /* @__PURE__ */ jsx("p", {
						className: "mt-0.5 text-xs text-ink-soft",
						children: "Active hours divided by available hours"
					})] }), /* @__PURE__ */ jsx(StatusBadge, { status: "80% average" })]
				}), /* @__PURE__ */ jsx("div", {
					className: "mt-6 grid h-52 grid-cols-7 items-end gap-3 border-b border-line px-2",
					children: [
						72,
						78,
						68,
						82,
						75,
						86,
						80
					].map((value, index) => /* @__PURE__ */ jsxs("div", {
						className: "flex h-full flex-col items-center justify-end gap-2",
						children: [
							/* @__PURE__ */ jsxs("span", {
								className: "text-xs font-medium text-ink-soft",
								children: [value, "%"]
							}),
							/* @__PURE__ */ jsx("div", {
								className: "w-full max-w-12 rounded-t-md bg-brand",
								style: { height: `${value}%` }
							}),
							/* @__PURE__ */ jsx("span", {
								className: "pb-2 text-xs text-ink-soft",
								children: [
									"Fri",
									"Sat",
									"Sun",
									"Mon",
									"Tue",
									"Wed",
									"Thu"
								][index]
							})
						]
					}, index))
				})]
			}), /* @__PURE__ */ jsxs(Panel, {
				className: "overflow-hidden",
				children: [/* @__PURE__ */ jsx("div", {
					className: "border-b border-line px-4 py-3",
					children: /* @__PURE__ */ jsx("h2", {
						className: "font-semibold text-ink",
						children: administrator ? "Audit trail" : "Operational indicators"
					})
				}), administrator ? auditEvents.length === 0 ? /* @__PURE__ */ jsx(EmptyState, {
					compact: true,
					icon: Activity,
					title: "No audit activity recorded",
					message: "Sensitive changes and recovery events will appear here."
				}) : /* @__PURE__ */ jsx("div", {
					className: "divide-y divide-line",
					children: auditEvents.map((event) => /* @__PURE__ */ jsxs("div", {
						className: "grid gap-2 px-4 py-3 sm:grid-cols-[10rem_1fr_8rem]",
						children: [
							/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
								className: "text-sm font-medium text-ink",
								children: event.actor
							}), /* @__PURE__ */ jsx("p", {
								className: "mt-0.5 text-xs text-ink-soft",
								children: event.timestamp
							})] }),
							/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
								className: "text-sm font-medium text-ink",
								children: event.action
							}), /* @__PURE__ */ jsx("p", {
								className: "mt-0.5 text-xs text-ink-soft",
								children: event.detail
							})] }),
							/* @__PURE__ */ jsx(StatusBadge, { status: "Recorded" })
						]
					}, event.id))
				}) : /* @__PURE__ */ jsx("div", {
					className: "divide-y divide-line",
					children: [
						[
							"Dispatches completed on schedule",
							"92%",
							"Up 4 points"
						],
						[
							"Safety checklist completion",
							"98%",
							"Within target"
						],
						[
							"Average resource utilization",
							"80%",
							"Healthy capacity"
						],
						[
							"Fuel variance vs baseline",
							"+3.2%",
							"TR-03 requires review"
						]
					].map(([label, value, note]) => /* @__PURE__ */ jsxs("div", {
						className: "grid gap-2 px-4 py-3 sm:grid-cols-[1fr_6rem_10rem] sm:items-center",
						children: [
							/* @__PURE__ */ jsx("span", {
								className: "text-sm font-medium text-ink",
								children: label
							}),
							/* @__PURE__ */ jsx("span", {
								className: "text-lg font-semibold text-ink",
								children: value
							}),
							/* @__PURE__ */ jsx("span", {
								className: "text-xs text-ink-soft",
								children: note
							})
						]
					}, label))
				})]
			})]
		}), /* @__PURE__ */ jsxs("div", {
			className: "space-y-4",
			children: [/* @__PURE__ */ jsxs(Panel, {
				className: "p-4",
				children: [/* @__PURE__ */ jsx("h2", {
					className: "font-semibold text-ink",
					children: "Resource snapshot"
				}), /* @__PURE__ */ jsxs("div", {
					className: "mt-4 space-y-4",
					children: [
						/* @__PURE__ */ jsx(ProgressBar, {
							value: Math.round(resources.reduce((sum, item) => sum + item.utilization, 0) / resources.length),
							label: "Overall utilization"
						}),
						/* @__PURE__ */ jsx(ProgressBar, {
							value: 94,
							label: "Availability"
						}),
						/* @__PURE__ */ jsx(ProgressBar, {
							value: 91,
							label: "Credential readiness"
						})
					]
				})]
			}), administrator && /* @__PURE__ */ jsxs(Panel, {
				className: "p-4",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "flex items-center gap-3",
						children: [/* @__PURE__ */ jsx(DatabaseBackup, {
							className: "h-5 w-5 text-success",
							"aria-hidden": "true"
						}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", {
							className: "font-semibold text-ink",
							children: "Recovery status"
						}), /* @__PURE__ */ jsx("p", {
							className: "mt-0.5 text-xs text-ink-soft",
							children: "Last verified today at 02:12"
						})] })]
					}),
					/* @__PURE__ */ jsx(InlineNotice, {
						tone: "success",
						title: "Backup verified",
						children: "The latest nightly snapshot passed its integrity check."
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-4 space-y-2",
						children: [/* @__PURE__ */ jsx(Button, {
							className: "w-full",
							variant: "secondary",
							children: "Create manual backup"
						}), !restoreArmed ? /* @__PURE__ */ jsxs(Button, {
							className: "w-full",
							variant: "quiet",
							onClick: () => setRestoreArmed(true),
							children: [/* @__PURE__ */ jsx(ArchiveRestore, {
								className: "h-4 w-4",
								"aria-hidden": "true"
							}), "Prepare restore"]
						}) : /* @__PURE__ */ jsxs("div", {
							className: "rounded-lg bg-danger-soft p-3",
							children: [
								/* @__PURE__ */ jsx("p", {
									className: "text-sm font-semibold text-danger",
									children: "Restore the latest verified backup?"
								}),
								/* @__PURE__ */ jsx("p", {
									className: "mt-1 text-xs leading-5 text-red-800",
									children: "This prototype action is guarded and does not change data."
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "mt-3 flex gap-2",
									children: [/* @__PURE__ */ jsx(Button, {
										size: "sm",
										variant: "danger",
										children: "Restore backup"
									}), /* @__PURE__ */ jsx(Button, {
										size: "sm",
										onClick: () => setRestoreArmed(false),
										children: "Keep current data"
									})]
								})
							]
						})]
					})
				]
			})]
		})]
	})] });
}
//#endregion
//#region resources/js/components/surfaces/mobile-surfaces.tsx
var driverNavigation = [
	[
		"today",
		"Home",
		Home
	],
	[
		"job",
		"Jobs",
		ClipboardList
	],
	[
		"live",
		"Route",
		Map
	],
	[
		"issues",
		"Issues",
		AlertTriangle
	]
];
var operatorNavigation = [
	[
		"today",
		"Home",
		Home
	],
	[
		"job",
		"Job",
		ClipboardList
	],
	[
		"tasks",
		"Safety",
		ShieldCheck
	],
	[
		"issues",
		"Issues",
		Wrench
	]
];
var technicianNavigation = [
	[
		"tasks",
		"Tasks",
		ClipboardList
	],
	[
		"job",
		"Work order",
		Wrench
	],
	[
		"equipment",
		"Assets",
		ScanLine
	],
	[
		"issues",
		"Handover",
		CheckCircle2
	]
];
function MobileFrame({ role, section, connectivity, queuedActions, onSectionChange, onConnectivityChange, onSync, children }) {
	const nav = role === "driver" ? driverNavigation : role === "operator" ? operatorNavigation : technicianNavigation;
	return /* @__PURE__ */ jsxs("div", {
		className: "min-h-[calc(100vh-4.5rem)] bg-[#e8edf2] px-0 py-0 md:p-6",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "mx-auto flex min-h-[calc(100vh-4.5rem)] w-full max-w-[27rem] flex-col overflow-hidden bg-surface md:min-h-[50rem] md:rounded-2xl md:border md:border-line-strong md:shadow-lg",
			children: [
				/* @__PURE__ */ jsxs("header", {
					className: "flex min-h-16 items-center gap-3 border-b border-line px-3",
					children: [
						/* @__PURE__ */ jsx("button", {
							type: "button",
							className: "flex h-11 w-11 items-center justify-center rounded-lg hover:bg-surface-subtle",
							"aria-label": "Open app menu",
							children: /* @__PURE__ */ jsx(Menu, {
								className: "h-5 w-5",
								"aria-hidden": "true"
							})
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "min-w-0 flex-1 text-center",
							children: [/* @__PURE__ */ jsx("p", {
								className: "truncate text-sm font-semibold text-ink",
								children: roleLabels[role]
							}), /* @__PURE__ */ jsx("p", {
								className: "mt-0.5 text-[0.6875rem] text-ink-soft",
								children: "Prototype field app"
							})]
						}),
						/* @__PURE__ */ jsxs("button", {
							type: "button",
							className: "relative flex h-11 w-11 items-center justify-center rounded-lg hover:bg-surface-subtle",
							"aria-label": "Notifications, 2 unread",
							children: [/* @__PURE__ */ jsx(Bell, {
								className: "h-5 w-5",
								"aria-hidden": "true"
							}), /* @__PURE__ */ jsx("span", { className: "absolute top-2 right-2 h-2 w-2 rounded-full bg-danger ring-2 ring-surface" })]
						})
					]
				}),
				connectivity === "offline" && /* @__PURE__ */ jsxs("div", {
					className: "flex items-center gap-3 bg-warning-soft px-4 py-3 text-sm text-amber-950",
					children: [
						/* @__PURE__ */ jsx(CloudOff, {
							className: "h-4 w-4 shrink-0",
							"aria-hidden": "true"
						}),
						/* @__PURE__ */ jsxs("span", {
							className: "flex-1",
							children: [
								"Offline · ",
								queuedActions,
								" update",
								queuedActions === 1 ? "" : "s",
								" queued"
							]
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: onSync,
							className: "min-h-9 rounded-lg px-2 font-semibold hover:bg-amber-100",
							children: "Reconnect"
						})
					]
				}),
				/* @__PURE__ */ jsx("div", {
					className: "flex-1 scrollbar-thin overflow-y-auto bg-canvas",
					children
				}),
				/* @__PURE__ */ jsx("footer", {
					className: "mobile-safe-bottom border-t border-line bg-surface px-2 pt-2",
					children: /* @__PURE__ */ jsx("nav", {
						className: "grid grid-cols-4",
						"aria-label": `${roleLabels[role]} mobile navigation`,
						children: nav.map(([navSection, label, Icon]) => {
							const active = section === navSection;
							return /* @__PURE__ */ jsxs("button", {
								type: "button",
								onClick: () => onSectionChange(navSection),
								className: cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[0.6875rem] font-medium", active ? "text-brand" : "text-ink-soft hover:bg-surface-subtle hover:text-ink"),
								"aria-current": active ? "page" : void 0,
								children: [/* @__PURE__ */ jsx(Icon, {
									className: "h-5 w-5",
									"aria-hidden": "true"
								}), label]
							}, navSection);
						})
					})
				})
			]
		}), /* @__PURE__ */ jsxs("div", {
			className: "mx-auto mt-4 hidden max-w-[27rem] items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3 text-xs text-ink-soft md:flex",
			children: [/* @__PURE__ */ jsxs("span", { children: ["Connection simulator: ", /* @__PURE__ */ jsx("strong", { children: connectivity })] }), /* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: () => onConnectivityChange(connectivity === "offline" ? "online" : "offline"),
				className: "min-h-9 rounded-lg px-3 font-semibold text-brand hover:bg-brand-soft",
				children: connectivity === "offline" ? "Restore connection" : "Simulate offline"
			})]
		})]
	});
}
function MiniRouteMap() {
	return /* @__PURE__ */ jsxs("div", {
		className: "relative h-48 overflow-hidden rounded-xl bg-[#eaf0f3]",
		children: [/* @__PURE__ */ jsxs("svg", {
			className: "absolute inset-0 h-full w-full",
			viewBox: "0 0 400 220",
			role: "img",
			"aria-label": "Simulated route from the current location to North Service Road",
			children: [
				/* @__PURE__ */ jsx("rect", {
					width: "400",
					height: "220",
					fill: "#eaf0f3"
				}),
				[
					"M-20 50 C90 75 160 30 270 55 S360 80 430 48",
					"M-20 142 C80 120 150 164 250 138 S350 122 430 152",
					"M80 -20 C95 55 70 120 100 240",
					"M250 -20 C230 70 280 130 250 240"
				].map((path) => /* @__PURE__ */ jsx("path", {
					d: path,
					fill: "none",
					stroke: "#c6d0d8",
					strokeWidth: "5",
					strokeLinecap: "round"
				}, path)),
				/* @__PURE__ */ jsx("path", {
					d: "M55 178 C105 142 128 98 185 112 S275 80 338 44",
					fill: "none",
					stroke: "#2563eb",
					strokeWidth: "7",
					strokeLinecap: "round"
				}),
				/* @__PURE__ */ jsx("circle", {
					cx: "55",
					cy: "178",
					r: "10",
					fill: "#16a34a"
				}),
				/* @__PURE__ */ jsx("circle", {
					cx: "338",
					cy: "44",
					r: "12",
					fill: "#dc2626",
					stroke: "white",
					strokeWidth: "4"
				})
			]
		}), /* @__PURE__ */ jsx("span", {
			className: "absolute right-3 bottom-3 rounded-lg bg-surface px-2.5 py-1.5 text-xs font-medium text-ink shadow-sm",
			children: "34 min · 18.2 km"
		})]
	});
}
function MobileSectionTitle({ title, subtitle }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "px-4 pt-5 pb-3",
		children: [/* @__PURE__ */ jsx("h1", {
			className: "text-xl font-semibold tracking-[-0.02em] text-ink",
			children: title
		}), /* @__PURE__ */ jsx("p", {
			className: "mt-1 text-sm leading-5 text-ink-soft",
			children: subtitle
		})]
	});
}
function DriverSurface({ section, job, connectivity, onAdvanceJob }) {
	const currentNext = {
		Scheduled: "Dispatched",
		Dispatched: "En route",
		"En route": "Arrived",
		Arrived: "In progress",
		"In progress": "Completed"
	}[job.status] ?? "En route";
	if (section === "live") return /* @__PURE__ */ jsxs("div", {
		className: "p-4",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "mb-4 flex items-center justify-between gap-3",
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h1", {
					className: "text-lg font-semibold text-ink",
					children: "Route to job site"
				}), /* @__PURE__ */ jsxs("p", {
					className: "mt-1 text-sm text-ink-soft",
					children: [
						job.reference,
						" · ",
						job.site
					]
				})] }), /* @__PURE__ */ jsx(StatusBadge, { status: job.status })]
			}),
			/* @__PURE__ */ jsx(MiniRouteMap, {}),
			/* @__PURE__ */ jsxs(Panel, {
				className: "mt-4 p-4",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-start gap-3",
					children: [/* @__PURE__ */ jsx(Navigation, {
						className: "mt-0.5 h-5 w-5 shrink-0 text-brand",
						"aria-hidden": "true"
					}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
						className: "font-semibold text-ink",
						children: "Arrive at North Service Road"
					}), /* @__PURE__ */ jsx("p", {
						className: "mt-1 text-sm leading-5 text-ink-soft",
						children: "Enter through the east service lane and keep the fire route clear."
					})] })]
				}), /* @__PURE__ */ jsx(Button, {
					className: "mt-4 w-full",
					variant: "primary",
					children: "Open turn-by-turn navigation"
				})]
			}),
			/* @__PURE__ */ jsx(InlineNotice, {
				tone: "info",
				title: "Location sharing is on",
				children: "Operations can see this device while the job is active."
			})
		]
	});
	if (section === "issues") return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(MobileSectionTitle, {
		title: "Report an issue",
		subtitle: "Choose the issue that best explains what is blocking the job."
	}), /* @__PURE__ */ jsxs("div", {
		className: "space-y-2 px-4 pb-6",
		children: [[
			["Traffic or route obstruction", Route],
			["Vehicle problem", Truck],
			["Site access problem", MapPin],
			["Accident or safety incident", TriangleAlert]
		].map(([label, Icon]) => /* @__PURE__ */ jsxs("button", {
			type: "button",
			className: "flex min-h-16 w-full items-center gap-3 rounded-xl border border-line bg-surface px-4 text-left hover:bg-surface-subtle",
			children: [
				/* @__PURE__ */ jsx(Icon, {
					className: "h-5 w-5 text-ink-soft",
					"aria-hidden": "true"
				}),
				/* @__PURE__ */ jsx("span", {
					className: "flex-1 text-sm font-medium text-ink",
					children: String(label)
				}),
				/* @__PURE__ */ jsx(ChevronRight, {
					className: "h-4 w-4 text-muted",
					"aria-hidden": "true"
				})
			]
		}, String(label))), /* @__PURE__ */ jsx(Button, {
			className: "mt-3 w-full",
			onClick: () => onAdvanceJob("On hold"),
			children: "Place job on hold"
		})]
	})] });
	return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(MobileSectionTitle, {
		title: section === "job" ? "Job details" : "Today’s assignment",
		subtitle: "Your next action and required field records are kept together."
	}), /* @__PURE__ */ jsxs("div", {
		className: "space-y-3 px-4 pb-6",
		children: [
			/* @__PURE__ */ jsxs(Panel, {
				className: "overflow-hidden",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-center justify-between gap-3 bg-success-soft px-4 py-3 text-sm text-green-900",
					children: [/* @__PURE__ */ jsx("span", {
						className: "font-semibold",
						children: job.status
					}), /* @__PURE__ */ jsx("span", { children: job.startTime })]
				}), /* @__PURE__ */ jsxs("div", {
					className: "p-4",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "flex items-start justify-between gap-3",
							children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
								className: "text-xs text-ink-soft",
								children: job.reference
							}), /* @__PURE__ */ jsx("h2", {
								className: "mt-1 text-lg font-semibold text-ink",
								children: job.title
							})] }), /* @__PURE__ */ jsx(StatusBadge, { status: job.priority })]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-4 flex items-start gap-3 rounded-lg bg-surface-subtle p-3",
							children: [/* @__PURE__ */ jsx(MapPin, {
								className: "mt-0.5 h-5 w-5 shrink-0 text-brand",
								"aria-hidden": "true"
							}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
								className: "text-sm font-semibold text-ink",
								children: job.site
							}), /* @__PURE__ */ jsx("p", {
								className: "mt-1 text-xs leading-5 text-ink-soft",
								children: job.siteNote
							})] })]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-4 grid grid-cols-2 gap-3 text-sm",
							children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
								className: "text-xs text-ink-soft",
								children: "Schedule"
							}), /* @__PURE__ */ jsxs("p", {
								className: "mt-1 font-medium text-ink",
								children: [
									job.startTime,
									"–",
									job.endTime
								]
							})] }), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
								className: "text-xs text-ink-soft",
								children: "Vehicle"
							}), /* @__PURE__ */ jsx("p", {
								className: "mt-1 font-medium text-ink",
								children: "TR-02"
							})] })]
						})
					]
				})]
			}),
			/* @__PURE__ */ jsxs(Panel, {
				className: "p-4",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-center justify-between gap-3",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
						className: "text-xs text-ink-soft",
						children: "Next action"
					}), /* @__PURE__ */ jsxs("p", {
						className: "mt-1 font-semibold text-ink",
						children: ["Change status to ", currentNext]
					})] }), /* @__PURE__ */ jsx(Clock3, {
						className: "h-5 w-5 text-brand",
						"aria-hidden": "true"
					})]
				}), /* @__PURE__ */ jsxs(Button, {
					className: "mt-4 w-full",
					variant: "primary",
					onClick: () => onAdvanceJob(currentNext),
					children: [
						/* @__PURE__ */ jsx(Check, {
							className: "h-4 w-4",
							"aria-hidden": "true"
						}),
						"Mark ",
						currentNext
					]
				})]
			}),
			section === "job" && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs(Panel, {
				className: "p-4",
				children: [
					/* @__PURE__ */ jsx("h2", {
						className: "font-semibold text-ink",
						children: "Proof of delivery"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-1 text-sm leading-5 text-ink-soft",
						children: "Add completion photos and recipient confirmation before closing the job."
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-4 grid grid-cols-2 gap-2",
						children: [/* @__PURE__ */ jsxs(Button, { children: [/* @__PURE__ */ jsx(Camera, {
							className: "h-4 w-4",
							"aria-hidden": "true"
						}), "Add photos"] }), /* @__PURE__ */ jsxs(Button, { children: [/* @__PURE__ */ jsx(Signature, {
							className: "h-4 w-4",
							"aria-hidden": "true"
						}), "Add signature"] })]
					})
				]
			}), /* @__PURE__ */ jsx(Panel, {
				className: "p-4",
				children: /* @__PURE__ */ jsxs("div", {
					className: "flex items-center justify-between gap-3",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
						className: "font-semibold text-ink",
						children: "Sync status"
					}), /* @__PURE__ */ jsx("p", {
						className: "mt-1 text-sm text-ink-soft",
						children: connectivity === "online" ? "All field records are synchronized." : "Updates are stored on this device."
					})] }), connectivity === "online" ? /* @__PURE__ */ jsx(CheckCircle2, {
						className: "h-5 w-5 text-success",
						"aria-hidden": "true"
					}) : /* @__PURE__ */ jsx(CloudOff, {
						className: "h-5 w-5 text-warning",
						"aria-hidden": "true"
					})]
				})
			})] })
		]
	})] });
}
function OperatorSurface({ section, job, onAdvanceJob }) {
	const [checks, setChecks] = useState(Array.from({ length: 6 }, () => false));
	const completeCount = checks.filter(Boolean).length;
	const safetyComplete = completeCount === checks.length;
	if (section === "tasks") return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(MobileSectionTitle, {
		title: "Pre-operation safety",
		subtitle: "Complete all six checks before starting the lift."
	}), /* @__PURE__ */ jsxs("div", {
		className: "px-4 pb-6",
		children: [
			/* @__PURE__ */ jsxs(Panel, {
				className: "overflow-hidden",
				children: [/* @__PURE__ */ jsx("div", {
					className: "border-b border-line p-4",
					children: /* @__PURE__ */ jsx(ProgressBar, {
						value: completeCount / checks.length * 100,
						label: `${completeCount} of ${checks.length} checks complete`
					})
				}), /* @__PURE__ */ jsx("div", {
					className: "divide-y divide-line",
					children: [
						"Outriggers and ground conditions checked",
						"Wire rope and hook inspected",
						"Load chart matches lift plan",
						"Rigging crew briefing completed",
						"Exclusion zone established",
						"Emergency stop tested"
					].map((item, index) => /* @__PURE__ */ jsxs("label", {
						className: "flex min-h-16 cursor-pointer items-start gap-3 p-4 hover:bg-surface-subtle",
						children: [/* @__PURE__ */ jsx("input", {
							type: "checkbox",
							checked: checks[index],
							onChange: () => setChecks((current) => current.map((value, itemIndex) => itemIndex === index ? !value : value)),
							className: "mt-0.5 h-5 w-5 accent-brand"
						}), /* @__PURE__ */ jsx("span", {
							className: "text-sm leading-5 text-ink",
							children: item
						})]
					}, item))
				})]
			}),
			/* @__PURE__ */ jsxs(Button, {
				className: "mt-4 w-full",
				variant: "primary",
				disabled: !safetyComplete,
				onClick: () => onAdvanceJob("In progress"),
				children: [/* @__PURE__ */ jsx(Play, {
					className: "h-4 w-4",
					"aria-hidden": "true"
				}), "Start lift operation"]
			}),
			!safetyComplete && /* @__PURE__ */ jsx("p", {
				className: "mt-2 text-center text-xs text-ink-soft",
				children: "Complete the remaining safety checks to continue."
			})
		]
	})] });
	if (section === "issues") return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(MobileSectionTitle, {
		title: "Equipment condition",
		subtitle: "Report defects before they become a safety or schedule risk."
	}), /* @__PURE__ */ jsxs("div", {
		className: "space-y-3 px-4 pb-6",
		children: [/* @__PURE__ */ jsxs(Panel, {
			className: "p-4",
			children: [
				/* @__PURE__ */ jsxs("label", {
					className: "text-sm font-semibold text-ink",
					children: ["Issue category", /* @__PURE__ */ jsxs("select", {
						className: "mt-2 h-11 w-full rounded-lg border border-line bg-surface px-3 font-normal text-ink",
						children: [
							/* @__PURE__ */ jsx("option", { children: "Hydraulics" }),
							/* @__PURE__ */ jsx("option", { children: "Controls" }),
							/* @__PURE__ */ jsx("option", { children: "Rigging" }),
							/* @__PURE__ */ jsx("option", { children: "Safety device" })
						]
					})]
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "mt-4 block text-sm font-semibold text-ink",
					children: ["What did you observe?", /* @__PURE__ */ jsx("textarea", {
						className: "mt-2 min-h-28 w-full resize-y rounded-lg border border-line bg-surface p-3 font-normal text-ink",
						placeholder: "Describe the symptom and when it occurred"
					})]
				}),
				/* @__PURE__ */ jsxs(Button, {
					className: "mt-3 w-full",
					children: [/* @__PURE__ */ jsx(Camera, {
						className: "h-4 w-4",
						"aria-hidden": "true"
					}), "Add condition photos"]
				})
			]
		}), /* @__PURE__ */ jsx(Button, {
			className: "w-full",
			variant: "primary",
			onClick: () => onAdvanceJob("On hold"),
			children: "Report issue and place on hold"
		})]
	})] });
	return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(MobileSectionTitle, {
		title: section === "job" ? "Lift job" : "Today’s lift",
		subtitle: "Review site constraints, complete safety checks, and record equipment condition."
	}), /* @__PURE__ */ jsxs("div", {
		className: "space-y-3 px-4 pb-6",
		children: [
			/* @__PURE__ */ jsxs(Panel, {
				className: "p-4",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "flex items-start justify-between gap-3",
						children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
							className: "text-xs text-ink-soft",
							children: job.reference
						}), /* @__PURE__ */ jsx("h2", {
							className: "mt-1 text-lg font-semibold text-ink",
							children: job.title
						})] }), /* @__PURE__ */ jsx(StatusBadge, { status: job.status })]
					}),
					/* @__PURE__ */ jsx("div", {
						className: "mt-4 rounded-lg bg-surface-subtle p-3",
						children: /* @__PURE__ */ jsxs("div", {
							className: "flex items-start gap-3",
							children: [/* @__PURE__ */ jsx(MapPin, {
								className: "mt-0.5 h-5 w-5 shrink-0 text-brand",
								"aria-hidden": "true"
							}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
								className: "text-sm font-semibold text-ink",
								children: job.site
							}), /* @__PURE__ */ jsx("p", {
								className: "mt-1 text-xs leading-5 text-ink-soft",
								children: job.siteNote
							})] })]
						})
					}),
					/* @__PURE__ */ jsxs("dl", {
						className: "mt-3 divide-y divide-line",
						children: [
							/* @__PURE__ */ jsx(DataPair, {
								label: "Crane",
								value: "CR-250-04 · 250 ton"
							}),
							/* @__PURE__ */ jsx(DataPair, {
								label: "Work window",
								value: "07:30–15:30"
							}),
							/* @__PURE__ */ jsx(DataPair, {
								label: "Crew",
								value: "2-person rigging team"
							})
						]
					})
				]
			}),
			/* @__PURE__ */ jsxs("button", {
				type: "button",
				className: "flex min-h-20 w-full items-center gap-3 rounded-xl border border-line bg-surface p-4 text-left hover:bg-surface-subtle",
				children: [
					/* @__PURE__ */ jsx(ShieldCheck, {
						className: "h-6 w-6 text-brand",
						"aria-hidden": "true"
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ jsx("p", {
							className: "font-semibold text-ink",
							children: "Safety checklist"
						}), /* @__PURE__ */ jsxs("p", {
							className: "mt-1 text-sm text-ink-soft",
							children: [completeCount, " of 6 required checks"]
						})]
					}),
					/* @__PURE__ */ jsx(ChevronRight, {
						className: "h-4 w-4 text-muted",
						"aria-hidden": "true"
					})
				]
			}),
			section === "job" && /* @__PURE__ */ jsxs(Panel, {
				className: "p-4",
				children: [
					/* @__PURE__ */ jsx("h2", {
						className: "font-semibold text-ink",
						children: "Work record"
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-3 grid grid-cols-2 gap-2",
						children: [/* @__PURE__ */ jsxs(Button, { children: [/* @__PURE__ */ jsx(Camera, {
							className: "h-4 w-4",
							"aria-hidden": "true"
						}), "Add photos"] }), /* @__PURE__ */ jsxs(Button, { children: [/* @__PURE__ */ jsx(CircleGauge, {
							className: "h-4 w-4",
							"aria-hidden": "true"
						}), "Hours"] })]
					}),
					/* @__PURE__ */ jsx(Button, {
						className: "mt-3 w-full",
						variant: "primary",
						onClick: () => onAdvanceJob("Completed"),
						children: "Complete operation"
					})
				]
			})
		]
	})] });
}
function TechnicianSurface({ section, tasks, onAdvanceTask }) {
	const [selectedTaskId, setSelectedTaskId] = useState(tasks[0]?.id ?? "");
	const selected = tasks.find((task) => task.id === selectedTaskId) ?? tasks[0];
	if (section === "equipment") return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(MobileSectionTitle, {
		title: "Find an asset",
		subtitle: "Scan an equipment code or search the register before starting service."
	}), /* @__PURE__ */ jsxs("div", {
		className: "space-y-3 px-4 pb-6",
		children: [
			/* @__PURE__ */ jsxs(Button, {
				className: "h-28 w-full",
				variant: "primary",
				children: [/* @__PURE__ */ jsx(ScanLine, {
					className: "h-6 w-6",
					"aria-hidden": "true"
				}), "Scan asset code"]
			}),
			/* @__PURE__ */ jsx(Panel, {
				className: "p-4",
				children: /* @__PURE__ */ jsxs("label", {
					className: "text-sm font-semibold text-ink",
					children: ["Search the equipment register", /* @__PURE__ */ jsx("input", {
						type: "search",
						className: "mt-2 h-11 w-full rounded-lg border border-line bg-surface px-3 font-normal",
						placeholder: "Example: CR-250-04"
					})]
				})
			}),
			/* @__PURE__ */ jsx(InlineNotice, {
				tone: "info",
				title: "Recent asset",
				children: "CR-250-04 · Grove GMK5250 · North Yard, Bay 3"
			})
		]
	})] });
	if (!selected) return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(MobileSectionTitle, {
		title: "Assigned tasks",
		subtitle: "Prioritized maintenance and breakdown work for today."
	}), /* @__PURE__ */ jsx("div", {
		className: "px-4 pb-6",
		children: /* @__PURE__ */ jsx(Panel, { children: /* @__PURE__ */ jsx(EmptyState, {
			compact: true,
			icon: Wrench,
			title: "No service tasks assigned",
			message: "New maintenance and breakdown work will appear here when it is assigned to you."
		}) })
	})] });
	if (section === "issues") return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(MobileSectionTitle, {
		title: "Service handover",
		subtitle: "Record the final operating state and remaining restrictions."
	}), /* @__PURE__ */ jsxs("div", {
		className: "space-y-3 px-4 pb-6",
		children: [/* @__PURE__ */ jsxs(Panel, {
			className: "p-4",
			children: [
				/* @__PURE__ */ jsx("h2", {
					className: "font-semibold text-ink",
					children: selected?.assetCode
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "mt-4 block text-sm font-semibold text-ink",
					children: ["Return-to-service state", /* @__PURE__ */ jsxs("select", {
						className: "mt-2 h-11 w-full rounded-lg border border-line bg-surface px-3 font-normal",
						children: [
							/* @__PURE__ */ jsx("option", { children: "Operational" }),
							/* @__PURE__ */ jsx("option", { children: "Operational with restrictions" }),
							/* @__PURE__ */ jsx("option", { children: "Keep out of service" })
						]
					})]
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "mt-4 block text-sm font-semibold text-ink",
					children: ["Handover notes", /* @__PURE__ */ jsx("textarea", {
						className: "mt-2 min-h-28 w-full rounded-lg border border-line p-3 font-normal",
						placeholder: "State the completed work and any follow-up"
					})]
				})
			]
		}), selected && /* @__PURE__ */ jsxs(Button, {
			className: "w-full",
			variant: "primary",
			onClick: () => onAdvanceTask(selected.id, "Completed"),
			children: [/* @__PURE__ */ jsx(PackageCheck, {
				className: "h-4 w-4",
				"aria-hidden": "true"
			}), "Complete handover"]
		})]
	})] });
	if (section === "job" && selected) {
		const next = {
			Assigned: "Diagnosing",
			Diagnosing: "Repairing",
			Repairing: "Testing",
			Testing: "Completed",
			"Waiting for parts": "Repairing"
		}[selected.status] ?? "Diagnosing";
		return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(MobileSectionTitle, {
			title: selected.reference,
			subtitle: selected.title
		}), /* @__PURE__ */ jsxs("div", {
			className: "space-y-3 px-4 pb-6",
			children: [
				/* @__PURE__ */ jsxs(Panel, {
					className: "p-4",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "flex items-start justify-between gap-3",
						children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
							className: "text-xs text-ink-soft",
							children: "Asset"
						}), /* @__PURE__ */ jsx("p", {
							className: "mt-1 font-semibold text-ink",
							children: selected.assetCode
						})] }), /* @__PURE__ */ jsx(StatusBadge, { status: selected.status })]
					}), /* @__PURE__ */ jsxs("dl", {
						className: "mt-3 divide-y divide-line",
						children: [
							/* @__PURE__ */ jsx(DataPair, {
								label: "Location",
								value: selected.location
							}),
							/* @__PURE__ */ jsx(DataPair, {
								label: "Schedule",
								value: selected.scheduledAt
							}),
							/* @__PURE__ */ jsx(DataPair, {
								label: "Priority",
								value: /* @__PURE__ */ jsx(StatusBadge, { status: selected.priority })
							})
						]
					})]
				}),
				/* @__PURE__ */ jsxs(Panel, {
					className: "p-4",
					children: [/* @__PURE__ */ jsx(ProgressBar, {
						value: selected.checklistCompleted / selected.checklistTotal * 100,
						label: `${selected.checklistCompleted} of ${selected.checklistTotal} service checks`
					}), /* @__PURE__ */ jsxs("div", {
						className: "mt-4 grid grid-cols-2 gap-2",
						children: [/* @__PURE__ */ jsxs(Button, { children: [/* @__PURE__ */ jsx(Camera, {
							className: "h-4 w-4",
							"aria-hidden": "true"
						}), "Add photos"] }), /* @__PURE__ */ jsxs(Button, { children: [/* @__PURE__ */ jsx(FileText, {
							className: "h-4 w-4",
							"aria-hidden": "true"
						}), "Add notes"] })]
					})]
				}),
				/* @__PURE__ */ jsxs(Button, {
					className: "w-full",
					variant: "primary",
					onClick: () => onAdvanceTask(selected.id, next),
					children: ["Move task to ", next]
				})
			]
		})] });
	}
	return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(MobileSectionTitle, {
		title: "Assigned tasks",
		subtitle: "Prioritized maintenance and breakdown work for today."
	}), /* @__PURE__ */ jsx("div", {
		className: "space-y-3 px-4 pb-6",
		children: tasks.map((task) => /* @__PURE__ */ jsxs("button", {
			type: "button",
			onClick: () => setSelectedTaskId(task.id),
			className: cn("w-full rounded-xl border bg-surface p-4 text-left", task.id === selectedTaskId ? "border-brand ring-2 ring-brand/15" : "border-line hover:bg-surface-subtle"),
			children: [/* @__PURE__ */ jsxs("div", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("p", {
					className: "text-xs text-ink-soft",
					children: [
						task.reference,
						" · ",
						task.assetCode
					]
				}), /* @__PURE__ */ jsx("p", {
					className: "mt-1 leading-5 font-semibold text-ink",
					children: task.title
				})] }), /* @__PURE__ */ jsx(StatusBadge, { status: task.priority })]
			}), /* @__PURE__ */ jsxs("div", {
				className: "mt-3 flex items-center justify-between gap-3 text-xs text-ink-soft",
				children: [/* @__PURE__ */ jsx("span", { children: task.location }), /* @__PURE__ */ jsx(StatusBadge, { status: task.status })]
			})]
		}, task.id))
	})] });
}
function FieldMobileApp({ role, section, jobs, fieldTasks, connectivity, queuedActions, onSectionChange, onConnectivityChange, onSync, onAdvanceJob, onAdvanceTask }) {
	const assignedJob = jobs.find((job) => job.reference === "CON-1251") ?? jobs[0];
	return /* @__PURE__ */ jsx(MobileFrame, {
		role,
		section,
		connectivity,
		queuedActions,
		onSectionChange,
		onConnectivityChange,
		onSync,
		children: role === "technician" ? /* @__PURE__ */ jsx(TechnicianSurface, {
			section,
			tasks: fieldTasks,
			onAdvanceTask
		}) : !assignedJob ? /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(MobileSectionTitle, {
			title: "Assigned work",
			subtitle: "Today’s dispatch assignments and field status."
		}), /* @__PURE__ */ jsx("div", {
			className: "px-4 pb-6",
			children: /* @__PURE__ */ jsx(Panel, { children: /* @__PURE__ */ jsx(EmptyState, {
				compact: true,
				icon: ClipboardList,
				title: "No job assigned",
				message: "Your next field assignment will appear here after dispatch confirms it."
			}) })
		})] }) : role === "driver" ? /* @__PURE__ */ jsx(DriverSurface, {
			section,
			job: assignedJob,
			connectivity,
			onAdvanceJob: (status) => onAdvanceJob(assignedJob.id, status)
		}) : role === "operator" ? /* @__PURE__ */ jsx(OperatorSurface, {
			section,
			job: assignedJob,
			onAdvanceJob: (status) => onAdvanceJob(assignedJob.id, status)
		}) : null
	});
}
//#endregion
//#region resources/js/components/surfaces/resource-surfaces.tsx
function resourceDetail(resource) {
	switch (resource.kind) {
		case "truck": return [
			["Vehicle type", resource.subtype],
			["Odometer", `${resource.odometerKm.toLocaleString()} km`],
			["Next service", resource.nextService]
		];
		case "crane": return [
			["Rated capacity", `${resource.capacityTons} tons`],
			["Operating hours", resource.operatingHours.toLocaleString()],
			["Certification", resource.certification]
		];
		case "equipment": return [["Equipment type", resource.subtype], ["Inspection due", resource.inspectionDue]];
		case "driver": return [["License", resource.license], ["Qualification", resource.qualification]];
		case "operator": return [["Certification", resource.certification], ["Recent lifts", `${resource.liftsLast90Days} in 90 days`]];
		case "technician": return [["Specialty", resource.specialty], ["Open tasks", String(resource.openTasks)]];
	}
}
function ResourceDirectory({ mode, resources, selectedAssetId, query, role, onClearQuery, onSelectAsset }) {
	const [statusFilter, setStatusFilter] = useState("All statuses");
	const allowedKinds = mode === "fleet" ? ["truck", "driver"] : [
		"crane",
		"equipment",
		"operator",
		"technician"
	];
	const filtered = resources.filter((resource) => allowedKinds.includes(resource.kind)).filter((resource) => {
		const matchesQuery = `${resource.code} ${resource.name} ${resource.location}`.toLowerCase().includes(query.toLowerCase());
		const matchesStatus = statusFilter === "All statuses" || resource.status === statusFilter;
		return matchesQuery && matchesStatus;
	});
	const hasActiveFilters = Boolean(query) || statusFilter !== "All statuses";
	const clearFilters = () => {
		setStatusFilter("All statuses");
		onClearQuery();
	};
	const selected = filtered.find((resource) => resource.id === selectedAssetId) ?? filtered[0];
	return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(PageHeading, {
		title: mode === "fleet" ? "Fleet management" : "Cranes & equipment",
		description: mode === "fleet" ? "Track vehicle readiness, assignment, maintenance, location, and utilization." : "Manage crane capacity, inspection, certification, operating status, and support equipment.",
		actions: /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs(Button, {
			variant: "secondary",
			children: [/* @__PURE__ */ jsx(Download, {
				className: "h-4 w-4",
				"aria-hidden": "true"
			}), "Export register"]
		}), role === "administrator" && /* @__PURE__ */ jsxs(Button, {
			variant: "primary",
			children: [/* @__PURE__ */ jsx(Plus, {
				className: "h-4 w-4",
				"aria-hidden": "true"
			}), "Register resource"]
		})] })
	}), /* @__PURE__ */ jsxs("div", {
		className: "grid gap-4 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_22rem]",
		children: [/* @__PURE__ */ jsxs(Panel, {
			className: "min-w-0 overflow-hidden",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "relative max-w-md flex-1",
					children: [/* @__PURE__ */ jsx(Search, {
						className: "pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted",
						"aria-hidden": "true"
					}), /* @__PURE__ */ jsx("p", {
						className: "h-10 rounded-lg border border-line bg-surface-subtle py-2 pr-3 pl-9 text-sm text-ink-soft",
						children: query ? `Filtered by “${query}”` : `Showing ${filtered.length} registered resources`
					})]
				}), /* @__PURE__ */ jsxs("label", {
					className: "relative",
					children: [
						/* @__PURE__ */ jsx("span", {
							className: "sr-only",
							children: "Filter resource status"
						}),
						/* @__PURE__ */ jsxs("select", {
							value: statusFilter,
							onChange: (event) => setStatusFilter(event.target.value),
							className: "h-10 appearance-none rounded-lg border border-line bg-surface pr-9 pl-3 text-sm text-ink",
							children: [
								/* @__PURE__ */ jsx("option", { children: "All statuses" }),
								/* @__PURE__ */ jsx("option", { children: "Available" }),
								/* @__PURE__ */ jsx("option", { children: "Assigned" }),
								/* @__PURE__ */ jsx("option", { children: "Working" }),
								/* @__PURE__ */ jsx("option", { children: "Maintenance" }),
								/* @__PURE__ */ jsx("option", { children: "Offline" })
							]
						}),
						/* @__PURE__ */ jsx(SlidersHorizontal, {
							className: "pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted",
							"aria-hidden": "true"
						})
					]
				})]
			}), filtered.length === 0 ? /* @__PURE__ */ jsx(EmptyState, {
				announce: hasActiveFilters,
				icon: hasActiveFilters ? SearchX : Truck,
				title: hasActiveFilters ? "No resources match these filters" : `No ${mode === "fleet" ? "fleet resources" : "equipment"} registered`,
				message: hasActiveFilters ? "Clear the workspace search and status filter to restore the register." : "Registered resources will appear here with their readiness and assignment status.",
				primaryAction: hasActiveFilters ? /* @__PURE__ */ jsx(Button, {
					variant: "secondary",
					onClick: clearFilters,
					children: "Clear resource filters"
				}) : void 0
			}) : /* @__PURE__ */ jsx("div", {
				className: "overflow-x-auto",
				children: /* @__PURE__ */ jsxs("table", {
					className: "w-full min-w-[48rem] border-collapse text-left",
					children: [/* @__PURE__ */ jsx("thead", {
						className: "bg-surface-subtle text-xs text-ink-soft",
						children: /* @__PURE__ */ jsxs("tr", { children: [
							/* @__PURE__ */ jsx("th", {
								className: "px-4 py-3 font-medium",
								children: "Resource"
							}),
							/* @__PURE__ */ jsx("th", {
								className: "px-4 py-3 font-medium",
								children: "Type"
							}),
							/* @__PURE__ */ jsx("th", {
								className: "px-4 py-3 font-medium",
								children: "Status"
							}),
							/* @__PURE__ */ jsx("th", {
								className: "px-4 py-3 font-medium",
								children: "Current location"
							}),
							/* @__PURE__ */ jsx("th", {
								className: "px-4 py-3 font-medium",
								children: "Utilization"
							})
						] })
					}), /* @__PURE__ */ jsx("tbody", {
						className: "divide-y divide-line",
						children: filtered.map((resource) => /* @__PURE__ */ jsxs("tr", {
							className: cn("cursor-pointer hover:bg-surface-subtle", selected?.id === resource.id && "bg-brand-soft"),
							onClick: () => onSelectAsset(resource.id),
							children: [
								/* @__PURE__ */ jsx("td", {
									className: "px-4 py-3",
									children: /* @__PURE__ */ jsxs("button", {
										type: "button",
										className: "text-left",
										onClick: () => onSelectAsset(resource.id),
										children: [/* @__PURE__ */ jsx("span", {
											className: "block text-sm font-semibold text-ink",
											children: resource.code
										}), /* @__PURE__ */ jsx("span", {
											className: "mt-0.5 block text-xs text-ink-soft",
											children: resource.name
										})]
									})
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-4 py-3 text-sm text-ink-soft capitalize",
									children: resource.kind
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-4 py-3",
									children: /* @__PURE__ */ jsx(StatusBadge, { status: resource.status })
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-4 py-3 text-sm text-ink-soft",
									children: resource.location
								}),
								/* @__PURE__ */ jsx("td", {
									className: "w-44 px-4 py-3",
									children: /* @__PURE__ */ jsx(ProgressBar, {
										value: resource.utilization,
										label: "Last 30 days"
									})
								})
							]
						}, resource.id))
					})]
				})
			})]
		}), selected && allowedKinds.includes(selected.kind) ? /* @__PURE__ */ jsxs(Panel, {
			className: "self-start overflow-hidden",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "border-b border-line p-4",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "flex items-start justify-between gap-3",
							children: [/* @__PURE__ */ jsx("div", {
								className: "flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand-strong",
								children: selected.kind === "truck" ? /* @__PURE__ */ jsx(Truck, {
									className: "h-5 w-5",
									"aria-hidden": "true"
								}) : /* @__PURE__ */ jsx(Wrench, {
									className: "h-5 w-5",
									"aria-hidden": "true"
								})
							}), /* @__PURE__ */ jsx(StatusBadge, { status: selected.status })]
						}),
						/* @__PURE__ */ jsx("h2", {
							className: "mt-3 text-lg font-semibold text-ink",
							children: selected.code
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mt-1 text-sm text-ink-soft",
							children: selected.name
						})
					]
				}),
				/* @__PURE__ */ jsxs("dl", {
					className: "divide-y divide-line px-4",
					children: [
						/* @__PURE__ */ jsx(DataPair, {
							label: "Location",
							value: selected.location
						}),
						/* @__PURE__ */ jsx(DataPair, {
							label: "Utilization",
							value: `${selected.utilization}%`
						}),
						resourceDetail(selected).map(([label, value]) => /* @__PURE__ */ jsx(DataPair, {
							label,
							value
						}, label))
					]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "space-y-2 border-t border-line p-4",
					children: [/* @__PURE__ */ jsx(Button, {
						className: "w-full",
						variant: "primary",
						children: "View full resource record"
					}), /* @__PURE__ */ jsxs(Button, {
						className: "w-full",
						variant: "secondary",
						children: [/* @__PURE__ */ jsx(MapPin, {
							className: "h-4 w-4",
							"aria-hidden": "true"
						}), "Open in live operations"]
					})]
				})
			]
		}) : /* @__PURE__ */ jsx(Panel, {
			className: "self-start",
			children: /* @__PURE__ */ jsx(EmptyState, {
				compact: true,
				icon: ClipboardCheck,
				title: "Select a resource",
				message: "Choose a row to inspect readiness, utilization, and maintenance."
			})
		})]
	})] });
}
function FuelManagement({ requests, role, query, onClearQuery, onDecide }) {
	const [view, setView] = useState("requests");
	const filtered = requests.filter((request) => `${request.reference} ${request.assetCode} ${request.jobReference} ${request.requestedBy}`.toLowerCase().includes(query.toLowerCase()));
	const totalLiters = requests.reduce((sum, request) => sum + request.liters, 0);
	const totalCost = requests.reduce((sum, request) => sum + request.cost, 0);
	const canApprove = role === "manager" || role === "administrator";
	return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(PageHeading, {
		title: canApprove ? "Fuel approvals" : "Fuel management",
		description: "Track fuel requests, approval decisions, dispensing records, meter readings, and operational anomalies.",
		actions: /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs(Button, {
			variant: "secondary",
			children: [/* @__PURE__ */ jsx(Download, {
				className: "h-4 w-4",
				"aria-hidden": "true"
			}), "Export fuel log"]
		}), !canApprove && /* @__PURE__ */ jsxs(Button, {
			variant: "primary",
			children: [/* @__PURE__ */ jsx(Plus, {
				className: "h-4 w-4",
				"aria-hidden": "true"
			}), "Create fuel request"]
		})] })
	}), /* @__PURE__ */ jsxs("div", {
		className: "space-y-4 p-4 md:p-6",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "grid gap-3 md:grid-cols-[1fr_1fr_1.35fr]",
				children: [
					/* @__PURE__ */ jsx(Panel, {
						className: "p-4",
						children: /* @__PURE__ */ jsxs("div", {
							className: "flex items-start justify-between gap-3",
							children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
								className: "text-sm text-ink-soft",
								children: "Pending approval"
							}), /* @__PURE__ */ jsx("p", {
								className: "mt-2 text-2xl font-semibold text-ink",
								children: requests.filter((request) => request.status === "Pending").length
							})] }), /* @__PURE__ */ jsx(ClipboardCheck, {
								className: "h-5 w-5 text-warning",
								"aria-hidden": "true"
							})]
						})
					}),
					/* @__PURE__ */ jsx(Panel, {
						className: "p-4",
						children: /* @__PURE__ */ jsxs("div", {
							className: "flex items-start justify-between gap-3",
							children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
								className: "text-sm text-ink-soft",
								children: "Recorded volume"
							}), /* @__PURE__ */ jsxs("p", {
								className: "mt-2 text-2xl font-semibold text-ink",
								children: [totalLiters.toLocaleString(), " L"]
							})] }), /* @__PURE__ */ jsx(Fuel, {
								className: "h-5 w-5 text-brand",
								"aria-hidden": "true"
							})]
						})
					}),
					/* @__PURE__ */ jsx(Panel, {
						className: "p-4",
						children: /* @__PURE__ */ jsxs("div", {
							className: "flex items-start justify-between gap-3",
							children: [/* @__PURE__ */ jsxs("div", { children: [
								/* @__PURE__ */ jsx("p", {
									className: "text-sm text-ink-soft",
									children: "Recorded cost"
								}),
								/* @__PURE__ */ jsxs("p", {
									className: "mt-2 text-2xl font-semibold text-ink",
									children: ["₱", totalCost.toLocaleString()]
								}),
								/* @__PURE__ */ jsx("p", {
									className: "mt-1 text-xs text-ink-soft",
									children: "Based on current prototype requests"
								})
							] }), /* @__PURE__ */ jsx(CircleDollarSign, {
								className: "h-5 w-5 text-success",
								"aria-hidden": "true"
							})]
						})
					})
				]
			}),
			/* @__PURE__ */ jsx(InlineNotice, {
				tone: "warning",
				title: "Consumption anomaly",
				children: "TR-03 is 14% above its rolling 30-day baseline. Review the overdue preventive service before the next dispatch."
			}),
			/* @__PURE__ */ jsxs(Panel, {
				className: "overflow-hidden",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "flex items-center gap-1 rounded-lg bg-surface-subtle p-1",
						children: [/* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => setView("requests"),
							className: cn("min-h-9 rounded-md px-3 text-sm font-medium", view === "requests" ? "bg-surface text-ink shadow-sm" : "text-ink-soft"),
							children: "Requests"
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => setView("logs"),
							className: cn("min-h-9 rounded-md px-3 text-sm font-medium", view === "logs" ? "bg-surface text-ink shadow-sm" : "text-ink-soft"),
							children: "Dispensing log"
						})]
					}), /* @__PURE__ */ jsxs("p", {
						className: "text-xs text-ink-soft",
						children: [filtered.length, " matching records"]
					})]
				}), filtered.length === 0 ? /* @__PURE__ */ jsx(EmptyState, {
					announce: Boolean(query),
					icon: query ? SearchX : Fuel,
					title: query ? "No fuel records match the search" : "No fuel records available",
					message: query ? "Try another request, job, asset, or requester name." : "Fuel requests and dispensing records will appear here when they are submitted.",
					primaryAction: query ? /* @__PURE__ */ jsx(Button, {
						variant: "secondary",
						onClick: onClearQuery,
						children: "Clear workspace search"
					}) : void 0
				}) : /* @__PURE__ */ jsx("div", {
					className: "overflow-x-auto",
					children: /* @__PURE__ */ jsxs("table", {
						className: "w-full min-w-[54rem] text-left",
						children: [/* @__PURE__ */ jsx("thead", {
							className: "bg-surface-subtle text-xs text-ink-soft",
							children: /* @__PURE__ */ jsxs("tr", { children: [
								/* @__PURE__ */ jsx("th", {
									className: "px-4 py-3 font-medium",
									children: "Request"
								}),
								/* @__PURE__ */ jsx("th", {
									className: "px-4 py-3 font-medium",
									children: "Asset / job"
								}),
								/* @__PURE__ */ jsx("th", {
									className: "px-4 py-3 font-medium",
									children: "Requested by"
								}),
								/* @__PURE__ */ jsx("th", {
									className: "px-4 py-3 font-medium",
									children: "Quantity"
								}),
								/* @__PURE__ */ jsx("th", {
									className: "px-4 py-3 font-medium",
									children: "Meter"
								}),
								/* @__PURE__ */ jsx("th", {
									className: "px-4 py-3 font-medium",
									children: "Status"
								}),
								/* @__PURE__ */ jsx("th", {
									className: "px-4 py-3 font-medium",
									children: "Action"
								})
							] })
						}), /* @__PURE__ */ jsx("tbody", {
							className: "divide-y divide-line",
							children: filtered.map((request) => /* @__PURE__ */ jsxs("tr", { children: [
								/* @__PURE__ */ jsxs("td", {
									className: "px-4 py-3",
									children: [/* @__PURE__ */ jsx("p", {
										className: "text-sm font-semibold text-ink",
										children: request.reference
									}), /* @__PURE__ */ jsx("p", {
										className: "mt-0.5 text-xs text-ink-soft",
										children: request.requestedAt
									})]
								}),
								/* @__PURE__ */ jsxs("td", {
									className: "px-4 py-3",
									children: [/* @__PURE__ */ jsx("p", {
										className: "text-sm font-medium text-ink",
										children: request.assetCode
									}), /* @__PURE__ */ jsx("p", {
										className: "mt-0.5 text-xs text-ink-soft",
										children: request.jobReference
									})]
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-4 py-3 text-sm text-ink-soft",
									children: request.requestedBy
								}),
								/* @__PURE__ */ jsxs("td", {
									className: "px-4 py-3",
									children: [/* @__PURE__ */ jsxs("p", {
										className: "text-sm font-medium text-ink",
										children: [request.liters, " L"]
									}), /* @__PURE__ */ jsxs("p", {
										className: "mt-0.5 text-xs text-ink-soft",
										children: ["₱", request.cost.toLocaleString()]
									})]
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-4 py-3 text-sm text-ink-soft",
									children: request.meterReading
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-4 py-3",
									children: /* @__PURE__ */ jsx(StatusBadge, { status: request.status })
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-4 py-3",
									children: canApprove && request.status === "Pending" ? /* @__PURE__ */ jsxs("div", {
										className: "flex gap-2",
										children: [/* @__PURE__ */ jsx(Button, {
											size: "sm",
											variant: "primary",
											onClick: () => onDecide(request.id, "Approved"),
											children: "Approve"
										}), /* @__PURE__ */ jsx(Button, {
											size: "sm",
											onClick: () => onDecide(request.id, "Rejected"),
											children: "Reject"
										})]
									}) : /* @__PURE__ */ jsx(Button, {
										size: "sm",
										variant: "quiet",
										children: "View record"
									})
								})
							] }, request.id))
						})]
					})
				})]
			})
		]
	})] });
}
//#endregion
//#region resources/js/data/fixtures.ts
var dispatchJobs = [
	{
		id: "job-1251",
		reference: "CON-1251",
		client: "Arcwell Construction",
		contact: "Nina Foster · +63 917 555 0184",
		title: "Rooftop HVAC unit lift",
		site: "5800 North Service Road, Quezon City",
		siteNote: "Set crane on the east service lane. Keep the fire access route open.",
		scheduledDate: "July 17, 2026",
		startTime: "07:30",
		endTime: "15:30",
		priority: "Priority",
		status: "Draft",
		workType: "Commercial lift · 250 ton class",
		requirements: [
			"220–250 ton all-terrain crane",
			"Certified HVAC lift operator",
			"Two-person rigging crew",
			"Oversize travel permit"
		],
		assignment: { supportEquipmentIds: [] }
	},
	{
		id: "job-1248",
		reference: "CON-1248",
		client: "Meralco Industrial Services",
		contact: "Aaron Lim · +63 917 555 0128",
		title: "Transformer placement",
		site: "Balintawak Substation, Quezon City",
		siteNote: "Check in at security gate 2 before site access.",
		scheduledDate: "July 17, 2026",
		startTime: "07:00",
		endTime: "10:00",
		priority: "Routine",
		status: "In progress",
		workType: "Utility lift · 220 ton class",
		requirements: ["220 ton crane", "Utility-qualified operator"],
		assignment: {
			craneId: "cr-220-01",
			operatorId: "op-mika",
			truckId: "tr-03",
			driverId: "dr-luis",
			supportEquipmentIds: ["eq-rig-02"]
		}
	},
	{
		id: "job-1252",
		reference: "CON-1252",
		client: "Apex Commercial Group",
		contact: "Mara Santos · +63 917 555 0152",
		title: "Steel beam unload",
		site: "C5 Industrial Park, Pasig City",
		siteNote: "Delivery gate closes at 16:00.",
		scheduledDate: "July 17, 2026",
		startTime: "11:00",
		endTime: "14:00",
		priority: "Routine",
		status: "Scheduled",
		workType: "Material handling · 160 ton class",
		requirements: ["160 ton crane", "Flatbed truck"],
		assignment: {
			craneId: "cr-160-02",
			operatorId: "op-robert",
			truckId: "tr-02",
			driverId: "dr-chris",
			supportEquipmentIds: []
		}
	},
	{
		id: "job-1256",
		reference: "CON-1256",
		client: "Northline Infrastructure",
		contact: "Paolo Reyes · +63 917 555 0156",
		title: "Emergency bridge support",
		site: "Marikina River Service Bridge",
		siteNote: "Coordinate lane closure with the site supervisor.",
		scheduledDate: "July 17, 2026",
		startTime: "09:30",
		endTime: "17:00",
		priority: "Emergency",
		status: "Dispatched",
		workType: "Emergency lift · 110 ton class",
		requirements: ["110 ton crane", "Traffic support"],
		assignment: {
			craneId: "cr-110-03",
			operatorId: "op-james",
			truckId: "tr-01",
			driverId: "dr-tony",
			supportEquipmentIds: ["eq-ml-01"]
		}
	}
];
var resources = [
	{
		id: "cr-220-01",
		code: "CR-220-01",
		name: "Liebherr LTM 1220",
		kind: "crane",
		status: "Working",
		location: "Balintawak Substation",
		utilization: 84,
		capacityTons: 220,
		operatingHours: 4870,
		certification: "Valid through Mar 2027"
	},
	{
		id: "cr-250-04",
		code: "CR-250-04",
		name: "Grove GMK5250",
		kind: "crane",
		status: "Available",
		location: "North Yard",
		utilization: 71,
		capacityTons: 250,
		operatingHours: 3420,
		certification: "Valid through Nov 2026"
	},
	{
		id: "cr-160-02",
		code: "CR-160-02",
		name: "Tadano ATF 160G",
		kind: "crane",
		status: "Assigned",
		location: "C5 Industrial Park",
		utilization: 76,
		capacityTons: 160,
		operatingHours: 5112,
		certification: "Valid through Feb 2027"
	},
	{
		id: "cr-110-03",
		code: "CR-110-03",
		name: "Tadano GR-1100",
		kind: "crane",
		status: "Assigned",
		location: "En route · Marikina",
		utilization: 68,
		capacityTons: 110,
		operatingHours: 6088,
		certification: "Inspection due in 18 days"
	},
	{
		id: "tr-01",
		code: "TR-01",
		name: "Isuzu Giga Boom Truck",
		kind: "truck",
		subtype: "Boom truck",
		status: "Assigned",
		location: "En route · Marikina",
		utilization: 79,
		odometerKm: 118420,
		nextService: "2,180 km remaining"
	},
	{
		id: "tr-02",
		code: "TR-02",
		name: "Hino 700 Flatbed",
		kind: "truck",
		subtype: "Flatbed",
		status: "Assigned",
		location: "South Yard",
		utilization: 73,
		odometerKm: 96410,
		nextService: "July 29, 2026"
	},
	{
		id: "tr-03",
		code: "TR-03",
		name: "Fuso Super Great",
		kind: "truck",
		subtype: "Step deck",
		status: "Working",
		location: "Balintawak Substation",
		utilization: 88,
		odometerKm: 137802,
		nextService: "Service overdue by 2 days"
	},
	{
		id: "eq-ml-01",
		code: "ML-01",
		name: "JLG 600S Manlift",
		kind: "equipment",
		subtype: "Manlift",
		status: "Assigned",
		location: "En route · Marikina",
		utilization: 62,
		inspectionDue: "August 12, 2026"
	},
	{
		id: "eq-rig-02",
		code: "RG-02",
		name: "Heavy Rigging Set 02",
		kind: "equipment",
		subtype: "Rigging set",
		status: "Working",
		location: "Balintawak Substation",
		utilization: 81,
		inspectionDue: "September 4, 2026"
	},
	{
		id: "dr-luis",
		code: "DR-018",
		name: "Luis Ramos",
		kind: "driver",
		status: "Working",
		location: "Balintawak Substation",
		utilization: 86,
		license: "CE · Valid",
		qualification: "Heavy haul and step deck"
	},
	{
		id: "dr-chris",
		code: "DR-031",
		name: "Chris Pangilinan",
		kind: "driver",
		status: "Assigned",
		location: "South Yard",
		utilization: 72,
		license: "CE · Valid",
		qualification: "Flatbed and hazardous cargo"
	},
	{
		id: "dr-tony",
		code: "DR-009",
		name: "Tony Garcia",
		kind: "driver",
		status: "Assigned",
		location: "En route · Marikina",
		utilization: 78,
		license: "CE · Valid",
		qualification: "Boom truck and emergency response"
	},
	{
		id: "op-mika",
		code: "OP-014",
		name: "Mika Williams",
		kind: "operator",
		status: "Working",
		location: "Balintawak Substation",
		utilization: 89,
		certification: "All-terrain crane · 250 ton",
		liftsLast90Days: 18
	},
	{
		id: "op-robert",
		code: "OP-027",
		name: "Robert Bautista",
		kind: "operator",
		status: "Assigned",
		location: "South Yard",
		utilization: 74,
		certification: "All-terrain crane · 180 ton",
		liftsLast90Days: 14
	},
	{
		id: "op-james",
		code: "OP-006",
		name: "James Ko",
		kind: "operator",
		status: "Assigned",
		location: "En route · Marikina",
		utilization: 82,
		certification: "Rough-terrain crane · 120 ton",
		liftsLast90Days: 21
	},
	{
		id: "tech-ana",
		code: "FT-012",
		name: "Ana Dizon",
		kind: "technician",
		status: "Assigned",
		location: "North Yard",
		utilization: 77,
		specialty: "Hydraulics and crane controls",
		openTasks: 3
	}
];
var gptProposal = {
	id: "proposal-1251",
	jobId: "job-1251",
	state: "Draft",
	generatedAt: "Today, 08:42",
	summary: "Assign CR-250-04 with operator Mika Williams. Move the crew start to 07:30 to clear a travel overlap and keep the lift inside the approved work window.",
	reasons: [
		"CR-250-04 is the nearest available crane that meets the 220–250 ton requirement.",
		"Mika Williams has completed 18 comparable commercial lifts in the last 90 days.",
		"The proposed team meets certification and site-access constraints."
	],
	assumptions: [
		"Normal weekday traffic after 06:00",
		"Travel permit approved before departure",
		"Eight-hour work duration remains unchanged"
	],
	conflicts: [{
		id: "conflict-travel",
		title: "Travel overlap",
		detail: "CR-250-04 returns from a Taguig job at 06:15. Original setup began at 07:00.",
		resolved: false
	}, {
		id: "conflict-permit",
		title: "Permit pending",
		detail: "The oversize travel permit is expected by 17:00 today and does not block the proposed schedule.",
		resolved: true
	}],
	proposedAssignment: {
		craneId: "cr-250-04",
		operatorId: "op-mika",
		truckId: "tr-02",
		driverId: "dr-chris",
		supportEquipmentIds: ["eq-rig-02"]
	}
};
var telemetry = [
	{
		id: "tel-cr220",
		resourceId: "cr-220-01",
		label: "CR-220-01",
		kind: "crane",
		x: 67,
		y: 28,
		freshness: "Live",
		updatedAt: "10:14",
		destination: "Balintawak Substation",
		eta: "On site"
	},
	{
		id: "tel-tr01",
		resourceId: "tr-01",
		label: "TR-01",
		kind: "truck",
		x: 44,
		y: 61,
		freshness: "Delayed",
		updatedAt: "10:11",
		destination: "Marikina River Bridge",
		eta: "10:46 · +18 min"
	},
	{
		id: "tel-cr110",
		resourceId: "cr-110-03",
		label: "CR-110-03",
		kind: "crane",
		x: 54,
		y: 54,
		freshness: "Live",
		updatedAt: "10:13",
		destination: "Marikina River Bridge",
		eta: "10:38"
	},
	{
		id: "tel-tr03",
		resourceId: "tr-03",
		label: "TR-03",
		kind: "truck",
		x: 72,
		y: 38,
		freshness: "Stale",
		updatedAt: "09:48",
		destination: "Balintawak Substation",
		eta: "Signal 26 min old"
	},
	{
		id: "tel-tech",
		resourceId: "tech-ana",
		label: "FT-012",
		kind: "technician",
		x: 27,
		y: 43,
		freshness: "Offline",
		updatedAt: "Yesterday, 17:04",
		destination: "North Yard",
		eta: "Offline"
	}
];
var fuelRequests = [
	{
		id: "fuel-0891",
		reference: "FR-0891",
		assetCode: "CR-110-03",
		jobReference: "CON-1256",
		requestedBy: "James Ko",
		liters: 180,
		fuelType: "Diesel",
		cost: 11880,
		meterReading: "6,088 hours",
		status: "Pending",
		requestedAt: "Today, 09:18"
	},
	{
		id: "fuel-0890",
		reference: "FR-0890",
		assetCode: "TR-03",
		jobReference: "CON-1248",
		requestedBy: "Luis Ramos",
		liters: 120,
		fuelType: "Diesel",
		cost: 7920,
		meterReading: "137,802 km",
		status: "Approved",
		requestedAt: "Today, 07:42"
	},
	{
		id: "fuel-0884",
		reference: "FR-0884",
		assetCode: "CR-220-01",
		jobReference: "CON-1248",
		requestedBy: "Mika Williams",
		liters: 210,
		fuelType: "Diesel",
		cost: 13860,
		meterReading: "4,870 hours",
		status: "Dispensed",
		requestedAt: "Yesterday, 16:20"
	}
];
var fieldTasks = [{
	id: "task-441",
	reference: "WO-0441",
	assetCode: "CR-250-04",
	title: "Inspect hydraulic pressure fluctuation",
	location: "North Yard · Bay 3",
	scheduledAt: "Today, 13:30",
	priority: "Priority",
	status: "Assigned",
	checklistCompleted: 0,
	checklistTotal: 7
}, {
	id: "task-438",
	reference: "WO-0438",
	assetCode: "TR-03",
	title: "Complete overdue preventive service",
	location: "Balintawak Substation",
	scheduledAt: "Today, 16:00",
	priority: "Routine",
	status: "Waiting for parts",
	checklistCompleted: 4,
	checklistTotal: 6
}];
var auditEvents = [
	{
		id: "audit-1",
		actor: "Dianne Santos",
		action: "Approved fuel request",
		detail: "FR-0890 · TR-03 · 120 L diesel",
		timestamp: "Today, 08:03"
	},
	{
		id: "audit-2",
		actor: "Marco Villanueva",
		action: "Updated emergency dispatch",
		detail: "CON-1256 · Added traffic-support requirement",
		timestamp: "Today, 07:56"
	},
	{
		id: "audit-3",
		actor: "System",
		action: "Verified backup",
		detail: "Nightly operations backup completed successfully",
		timestamp: "Today, 02:12"
	}
];
//#endregion
//#region resources/js/state/operations-reducer.ts
var defaultSectionForRole = {
	administrator: "board",
	dispatcher: "board",
	manager: "board",
	driver: "today",
	operator: "today",
	technician: "tasks"
};
function createInitialState(role = "dispatcher", section = defaultSectionForRole[role]) {
	return {
		role,
		section,
		sidebarCollapsed: false,
		connectivity: "online",
		queuedActions: 0,
		selectedJobId: "job-1251",
		selectedAssetId: "cr-250-04",
		jobs: structuredClone(dispatchJobs),
		resources: structuredClone(resources),
		proposal: structuredClone(gptProposal),
		telemetry: structuredClone(telemetry),
		fuelRequests: structuredClone(fuelRequests),
		fieldTasks: structuredClone(fieldTasks),
		auditEvents: structuredClone(auditEvents),
		toasts: []
	};
}
function addToast(state, toast) {
	return [...state.toasts, {
		...toast,
		id: Date.now()
	}].slice(-3);
}
function operationsReducer(state, action) {
	switch (action.type) {
		case "set-role": return {
			...state,
			role: action.role,
			section: action.section
		};
		case "set-section": return {
			...state,
			section: action.section
		};
		case "toggle-sidebar": return {
			...state,
			sidebarCollapsed: !state.sidebarCollapsed
		};
		case "select-job": return {
			...state,
			selectedJobId: action.jobId
		};
		case "select-asset": return {
			...state,
			selectedAssetId: action.assetId
		};
		case "resolve-conflict": return {
			...state,
			proposal: {
				...state.proposal,
				conflicts: state.proposal.conflicts.map((conflict) => conflict.id === action.conflictId ? {
					...conflict,
					resolved: true
				} : conflict)
			},
			toasts: addToast(state, {
				tone: "success",
				title: "Conflict resolved",
				message: "The updated 07:30 start is ready for review."
			})
		};
		case "confirm-dispatch":
			if (state.proposal.conflicts.some((conflict) => !conflict.resolved)) return {
				...state,
				toasts: addToast(state, {
					tone: "warning",
					title: "Resolve the travel conflict first",
					message: "Review the proposed start time before confirming this dispatch."
				})
			};
			return {
				...state,
				jobs: state.jobs.map((job) => job.id === action.jobId ? {
					...job,
					status: "Scheduled",
					startTime: "07:30",
					assignment: state.proposal.proposedAssignment
				} : job),
				proposal: {
					...state.proposal,
					state: "Confirmed"
				},
				auditEvents: [{
					id: `audit-${Date.now()}`,
					actor: "Marco Villanueva",
					action: "Confirmed GPT-assisted dispatch",
					detail: "CON-1251 · CR-250-04 · 07:30 start",
					timestamp: "Just now"
				}, ...state.auditEvents],
				toasts: addToast(state, {
					tone: "success",
					title: "Dispatch scheduled",
					message: "CON-1251 is scheduled for 07:30. The field team has been notified."
				})
			};
		case "advance-job": {
			const queuedActions = state.connectivity === "offline" ? state.queuedActions + 1 : state.queuedActions;
			return {
				...state,
				queuedActions,
				jobs: state.jobs.map((job) => job.id === action.jobId ? {
					...job,
					status: action.status
				} : job),
				toasts: addToast(state, {
					tone: state.connectivity === "offline" ? "warning" : "success",
					title: state.connectivity === "offline" ? "Update queued" : `Status changed to ${action.status}`,
					message: state.connectivity === "offline" ? "This update will sync when the connection returns." : "Operations can see the new field status."
				})
			};
		}
		case "decide-fuel-request": return {
			...state,
			fuelRequests: state.fuelRequests.map((request) => request.id === action.requestId ? {
				...request,
				status: action.status
			} : request),
			toasts: addToast(state, {
				tone: action.status === "Approved" ? "success" : "info",
				title: `Fuel request ${action.status.toLowerCase()}`,
				message: action.status === "Approved" ? "Dispatch and the requester can now see the approval." : "The requester has been notified with the decision."
			})
		};
		case "set-connectivity": return {
			...state,
			connectivity: action.connectivity,
			toasts: action.connectivity === "offline" ? addToast(state, {
				tone: "warning",
				title: "Working offline",
				message: "Job updates will be kept on this device until you reconnect."
			}) : state.toasts
		};
		case "sync-queue": return {
			...state,
			connectivity: "online",
			queuedActions: 0,
			toasts: addToast(state, {
				tone: "success",
				title: "Updates synchronized",
				message: "Operations now has your latest field activity."
			})
		};
		case "telemetry-tick": return {
			...state,
			telemetry: state.telemetry.map((point, index) => point.freshness === "Live" ? {
				...point,
				x: Math.max(8, Math.min(92, point.x + (index % 2 === 0 ? .35 : -.3))),
				y: Math.max(8, Math.min(88, point.y + (index % 2 === 0 ? .18 : -.22))),
				updatedAt: "Just now"
			} : point)
		};
		case "advance-task": {
			const queuedActions = state.connectivity === "offline" ? state.queuedActions + 1 : state.queuedActions;
			return {
				...state,
				queuedActions,
				fieldTasks: state.fieldTasks.map((task) => task.id === action.taskId ? {
					...task,
					status: action.status
				} : task),
				toasts: addToast(state, {
					tone: state.connectivity === "offline" ? "warning" : "success",
					title: state.connectivity === "offline" ? "Task update queued" : `Task moved to ${action.status}`,
					message: state.connectivity === "offline" ? "It will sync automatically when you reconnect." : "The maintenance record has been updated."
				})
			};
		}
		case "dismiss-toast": return {
			...state,
			toasts: state.toasts.filter((toast) => toast.id !== action.toastId)
		};
		default: return state;
	}
}
//#endregion
//#region resources/js/pages/operations.tsx
var sections = [
	"overview",
	"dispatch",
	"board",
	"live",
	"fleet",
	"equipment",
	"fuel",
	"reports",
	"administration",
	"today",
	"job",
	"tasks",
	"issues"
];
function initialRouteState(role) {
	if (typeof window === "undefined") return {
		role,
		section: defaultSectionForRole[role]
	};
	const params = new URLSearchParams(window.location.search);
	const persistedSection = window.localStorage.getItem("ctms-section");
	const sectionParam = params.get("view") ?? persistedSection;
	return {
		role,
		section: sections.includes(sectionParam) ? sectionParam : defaultSectionForRole[role]
	};
}
function Operations() {
	const { auth } = usePage().props;
	const initial = initialRouteState(auth.prototype_role ?? "dispatcher");
	const [state, dispatch] = useReducer(operationsReducer, createInitialState(initial.role, initial.section));
	const [query, setQuery] = useState("");
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		params.set("view", state.section);
		window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
		window.localStorage.setItem("ctms-section", state.section);
	}, [state.section]);
	useEffect(() => {
		const timer = window.setInterval(() => dispatch({ type: "telemetry-tick" }), 8e3);
		return () => window.clearInterval(timer);
	}, []);
	const selectSection = (section) => {
		dispatch({
			type: "set-section",
			section
		});
		setQuery("");
	};
	const renderWebSurface = () => {
		if (state.role === "administrator") switch (state.section) {
			case "board": return /* @__PURE__ */ jsx(DispatchBoard, {
				jobs: state.jobs,
				resources: state.resources,
				selectedJobId: state.selectedJobId,
				query,
				onClearQuery: () => setQuery(""),
				onSelectJob: (jobId) => dispatch({
					type: "select-job",
					jobId
				})
			});
			case "dispatch": return /* @__PURE__ */ jsx(GuidedDispatch, {
				jobs: state.jobs,
				resources: state.resources,
				proposal: state.proposal,
				selectedJobId: state.selectedJobId,
				query,
				onClearQuery: () => setQuery(""),
				onSelectJob: (jobId) => dispatch({
					type: "select-job",
					jobId
				}),
				onResolveConflict: (conflictId) => dispatch({
					type: "resolve-conflict",
					conflictId
				}),
				onConfirmDispatch: (jobId) => dispatch({
					type: "confirm-dispatch",
					jobId
				})
			});
			case "administration": return /* @__PURE__ */ jsx(AdministrationSurface, {});
			case "fleet": return /* @__PURE__ */ jsx(ResourceDirectory, {
				mode: "fleet",
				resources: state.resources,
				selectedAssetId: state.selectedAssetId,
				query,
				role: state.role,
				onClearQuery: () => setQuery(""),
				onSelectAsset: (assetId) => dispatch({
					type: "select-asset",
					assetId
				})
			});
			case "equipment": return /* @__PURE__ */ jsx(ResourceDirectory, {
				mode: "equipment",
				resources: state.resources,
				selectedAssetId: state.selectedAssetId,
				query,
				role: state.role,
				onClearQuery: () => setQuery(""),
				onSelectAsset: (assetId) => dispatch({
					type: "select-asset",
					assetId
				})
			});
			case "fuel": return /* @__PURE__ */ jsx(FuelManagement, {
				requests: state.fuelRequests,
				role: state.role,
				query,
				onClearQuery: () => setQuery(""),
				onDecide: (requestId, status) => dispatch({
					type: "decide-fuel-request",
					requestId,
					status
				})
			});
			case "reports": return /* @__PURE__ */ jsx(ReportsSurface, {
				resources: state.resources,
				auditEvents: state.auditEvents,
				administrator: true
			});
			default: return /* @__PURE__ */ jsx(AdministratorOverview, {
				resources: state.resources,
				auditEvents: state.auditEvents,
				onNavigate: selectSection
			});
		}
		if (state.role === "manager") switch (state.section) {
			case "live": return /* @__PURE__ */ jsx(LiveOperations, {
				telemetry: state.telemetry,
				selectedAssetId: state.selectedAssetId,
				onSelectAsset: (assetId) => dispatch({
					type: "select-asset",
					assetId
				})
			});
			case "board": return /* @__PURE__ */ jsx(DispatchBoard, {
				jobs: state.jobs,
				resources: state.resources,
				selectedJobId: state.selectedJobId,
				query,
				onClearQuery: () => setQuery(""),
				onSelectJob: (jobId) => dispatch({
					type: "select-job",
					jobId
				})
			});
			case "fleet":
			case "equipment": return /* @__PURE__ */ jsx(ResourceDirectory, {
				mode: state.section === "equipment" ? "equipment" : "fleet",
				resources: state.resources,
				selectedAssetId: state.selectedAssetId,
				query,
				role: state.role,
				onClearQuery: () => setQuery(""),
				onSelectAsset: (assetId) => dispatch({
					type: "select-asset",
					assetId
				})
			});
			case "fuel": return /* @__PURE__ */ jsx(FuelManagement, {
				requests: state.fuelRequests,
				role: state.role,
				query,
				onClearQuery: () => setQuery(""),
				onDecide: (requestId, status) => dispatch({
					type: "decide-fuel-request",
					requestId,
					status
				})
			});
			case "reports": return /* @__PURE__ */ jsx(ReportsSurface, {
				resources: state.resources,
				auditEvents: state.auditEvents
			});
			case "dispatch": return /* @__PURE__ */ jsx(GuidedDispatch, {
				jobs: state.jobs,
				resources: state.resources,
				proposal: state.proposal,
				selectedJobId: state.selectedJobId,
				query,
				onClearQuery: () => setQuery(""),
				onSelectJob: (jobId) => dispatch({
					type: "select-job",
					jobId
				}),
				onResolveConflict: (conflictId) => dispatch({
					type: "resolve-conflict",
					conflictId
				}),
				onConfirmDispatch: (jobId) => dispatch({
					type: "confirm-dispatch",
					jobId
				})
			});
			default: return /* @__PURE__ */ jsx(ManagerOverview, {
				jobs: state.jobs,
				fuelRequests: state.fuelRequests,
				onNavigate: selectSection
			});
		}
		switch (state.section) {
			case "board": return /* @__PURE__ */ jsx(DispatchBoard, {
				jobs: state.jobs,
				resources: state.resources,
				selectedJobId: state.selectedJobId,
				query,
				onClearQuery: () => setQuery(""),
				onSelectJob: (jobId) => dispatch({
					type: "select-job",
					jobId
				})
			});
			case "live": return /* @__PURE__ */ jsx(LiveOperations, {
				telemetry: state.telemetry,
				selectedAssetId: state.selectedAssetId,
				onSelectAsset: (assetId) => dispatch({
					type: "select-asset",
					assetId
				})
			});
			case "fleet":
			case "equipment": return /* @__PURE__ */ jsx(ResourceDirectory, {
				mode: state.section === "equipment" ? "equipment" : "fleet",
				resources: state.resources,
				selectedAssetId: state.selectedAssetId,
				query,
				role: state.role,
				onClearQuery: () => setQuery(""),
				onSelectAsset: (assetId) => dispatch({
					type: "select-asset",
					assetId
				})
			});
			case "fuel": return /* @__PURE__ */ jsx(FuelManagement, {
				requests: state.fuelRequests,
				role: state.role,
				query,
				onClearQuery: () => setQuery(""),
				onDecide: (requestId, status) => dispatch({
					type: "decide-fuel-request",
					requestId,
					status
				})
			});
			case "reports": return /* @__PURE__ */ jsx(ReportsSurface, {
				resources: state.resources,
				auditEvents: state.auditEvents
			});
			default: return /* @__PURE__ */ jsx(GuidedDispatch, {
				jobs: state.jobs,
				resources: state.resources,
				proposal: state.proposal,
				selectedJobId: state.selectedJobId,
				query,
				onClearQuery: () => setQuery(""),
				onSelectJob: (jobId) => dispatch({
					type: "select-job",
					jobId
				}),
				onResolveConflict: (conflictId) => dispatch({
					type: "resolve-conflict",
					conflictId
				}),
				onConfirmDispatch: (jobId) => dispatch({
					type: "confirm-dispatch",
					jobId
				})
			});
		}
	};
	const fieldRole = [
		"driver",
		"operator",
		"technician"
	].includes(state.role);
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		/* @__PURE__ */ jsx(Head, { title: "Core Transaction 2 Operations" }),
		/* @__PURE__ */ jsx(AppShell, {
			role: state.role,
			section: state.section,
			collapsed: fieldRole ? true : state.sidebarCollapsed,
			connectivity: state.connectivity,
			queuedActions: state.queuedActions,
			query,
			onQueryChange: setQuery,
			onSectionChange: selectSection,
			onToggleSidebar: () => dispatch({ type: "toggle-sidebar" }),
			children: fieldRole ? /* @__PURE__ */ jsx(FieldMobileApp, {
				role: state.role,
				section: state.section,
				jobs: state.jobs,
				fieldTasks: state.fieldTasks,
				connectivity: state.connectivity,
				queuedActions: state.queuedActions,
				onSectionChange: selectSection,
				onConnectivityChange: (connectivity) => dispatch({
					type: "set-connectivity",
					connectivity
				}),
				onSync: () => dispatch({ type: "sync-queue" }),
				onAdvanceJob: (jobId, status) => dispatch({
					type: "advance-job",
					jobId,
					status
				}),
				onAdvanceTask: (taskId, status) => dispatch({
					type: "advance-task",
					taskId,
					status
				})
			}) : renderWebSurface()
		}),
		/* @__PURE__ */ jsx(ToastStack, {
			toasts: state.toasts,
			onDismiss: (toastId) => dispatch({
				type: "dismiss-toast",
				toastId
			})
		})
	] });
}
//#endregion
export { Operations as default };

//# sourceMappingURL=operations-CMSpiXtW.js.map