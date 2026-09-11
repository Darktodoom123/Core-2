import { a as PageHeading, c as StatusBadge, n as DataPair, o as Panel, r as EmptyState, t as Button, u as cn } from "./ui-CuoqGbiO.js";
import { t as CanonicalStatusBadge } from "./canonical-status-badge-D9JpJjoH.js";
/* empty css                 */
import { Head, Link, router, useForm, usePage } from "@inertiajs/react";
import { Activity, AlertTriangle, ArrowRight, Bot, CalendarClock, CalendarDays, Check, ChevronLeft, ChevronRight, CircleCheck, ClipboardCheck, ClipboardList, Compass, FilePlus2, Fuel, Info, LayoutDashboard, LocateFixed, LockKeyhole, LogOut, MapPin, Menu, Navigation, PauseCircle, Plus, RefreshCw, Search, SearchX, ShieldCheck, Truck, UserRound, UserRoundPlus, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
//#region resources/js/components/dashboards/operations-overview-dashboard.tsx
function OperationsOverviewDashboard({ jobs, assets, fuelRequests, locations, approvals, capabilities, availableSections, onSectionChange }) {
	const actions = buildDashboardActions({
		assets,
		fuelRequests,
		locations,
		approvals,
		capabilities
	});
	const upcomingJobs = jobs.filter((job) => !["completed", "cancelled"].includes(job.status.value)).slice(0, 5);
	const dispatchableAssets = assets.filter((asset) => asset.is_dispatchable).length;
	const blockingAssets = assets.filter((asset) => asset.blocking_work_orders_count > 0).length;
	const canOpenDispatch = availableSections.includes("dispatch");
	const canOpenAssets = availableSections.includes("assets");
	return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(PageHeading, {
		title: "Operations overview",
		description: "Start with the decisions that affect safe dispatch, then move directly into the authorized workflow.",
		actions: canOpenDispatch ? /* @__PURE__ */ jsxs(Button, {
			variant: "primary",
			onClick: () => onSectionChange("dispatch"),
			children: ["Review dispatches", /* @__PURE__ */ jsx(ArrowRight, {
				className: "h-4 w-4",
				"aria-hidden": "true"
			})]
		}) : void 0
	}), /* @__PURE__ */ jsxs("div", {
		className: "space-y-6 p-4 md:p-6",
		children: [/* @__PURE__ */ jsxs("section", {
			"aria-labelledby": "decision-queue-heading",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "mb-3 flex items-end justify-between gap-4",
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", {
					id: "decision-queue-heading",
					className: "text-lg font-semibold tracking-[-0.02em]",
					children: "Decision queue"
				}), /* @__PURE__ */ jsx("p", {
					className: "mt-1 text-sm text-ink-soft",
					children: "Items requiring review are kept separate from completed operational context."
				})] }), /* @__PURE__ */ jsxs("span", {
					className: "text-sm font-medium text-ink-soft",
					children: [actions.length, " open"]
				})]
			}), /* @__PURE__ */ jsx(Panel, {
				className: "overflow-hidden",
				children: actions.length === 0 ? /* @__PURE__ */ jsx(EmptyState, {
					compact: true,
					icon: CircleCheck,
					title: "No decision blockers in this workspace",
					message: "There are no pending approvals, blocking assets, actionable fuel requests, or stale locations in the records available to you."
				}) : /* @__PURE__ */ jsx("ul", {
					className: "divide-y divide-line",
					children: actions.map((action) => /* @__PURE__ */ jsx(DashboardActionRow, {
						action,
						onClick: () => onSectionChange(action.section)
					}, `${action.section}-${action.title}`))
				})
			})]
		}), /* @__PURE__ */ jsxs("div", {
			className: "grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.8fr)]",
			children: [/* @__PURE__ */ jsxs("section", {
				"aria-labelledby": "scheduled-work-heading",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "mb-3",
					children: [/* @__PURE__ */ jsx("h2", {
						id: "scheduled-work-heading",
						className: "text-lg font-semibold tracking-[-0.02em]",
						children: "Upcoming work"
					}), /* @__PURE__ */ jsx("p", {
						className: "mt-1 text-sm text-ink-soft",
						children: "The next visible jobs, ordered by their server-provided schedule."
					})]
				}), /* @__PURE__ */ jsx(Panel, {
					className: "overflow-hidden",
					children: upcomingJobs.length === 0 ? /* @__PURE__ */ jsx(EmptyState, {
						compact: true,
						icon: CalendarClock,
						title: "No upcoming work is available",
						message: "Jobs visible to your account will appear here when they are scheduled or awaiting review.",
						primaryAction: canOpenDispatch ? /* @__PURE__ */ jsx(Button, {
							size: "sm",
							onClick: () => onSectionChange("dispatch"),
							children: "Open dispatch workspace"
						}) : void 0
					}) : /* @__PURE__ */ jsx("ul", {
						className: "divide-y divide-line",
						children: upcomingJobs.map((job) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs("button", {
							type: "button",
							onClick: () => onSectionChange("dispatch"),
							className: "flex min-h-20 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none",
							children: [
								/* @__PURE__ */ jsx(CalendarClock, {
									className: "h-5 w-5 shrink-0 text-ink-soft",
									"aria-hidden": "true"
								}),
								/* @__PURE__ */ jsxs("span", {
									className: "min-w-0 flex-1",
									children: [/* @__PURE__ */ jsxs("span", {
										className: "flex flex-wrap items-center gap-x-2 gap-y-1",
										children: [/* @__PURE__ */ jsx("span", {
											className: "font-semibold text-ink",
											children: job.reference
										}), /* @__PURE__ */ jsx(CanonicalStatusBadge, { status: job.status })]
									}), /* @__PURE__ */ jsxs("span", {
										className: "mt-1 block truncate text-sm text-ink-soft",
										children: [
											job.title,
											" · ",
											job.site
										]
									})]
								}),
								/* @__PURE__ */ jsx("span", {
									className: "shrink-0 text-right text-xs leading-5 text-ink-soft",
									children: formatSchedule(job.scheduled_start)
								})
							]
						}) }, job.id))
					})
				})]
			}), /* @__PURE__ */ jsxs("section", {
				"aria-labelledby": "readiness-heading",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "mb-3",
					children: [/* @__PURE__ */ jsx("h2", {
						id: "readiness-heading",
						className: "text-lg font-semibold tracking-[-0.02em]",
						children: "Resource readiness"
					}), /* @__PURE__ */ jsx("p", {
						className: "mt-1 text-sm text-ink-soft",
						children: "A concise readiness check before opening the assignment workflow."
					})]
				}), /* @__PURE__ */ jsxs(Panel, {
					className: "divide-y divide-line",
					children: [
						/* @__PURE__ */ jsx(ReadinessRow, {
							label: "Visible jobs",
							value: String(jobs.length),
							detail: "Current scoped workload",
							icon: CalendarClock
						}),
						/* @__PURE__ */ jsx(ReadinessRow, {
							label: "Dispatchable assets",
							value: String(dispatchableAssets),
							detail: "Ready in the records available to you",
							icon: Truck
						}),
						/* @__PURE__ */ jsx(ReadinessRow, {
							label: "Blocking work orders",
							value: String(blockingAssets),
							detail: blockingAssets === 1 ? "Asset requires safety review" : "Assets require safety review",
							icon: ShieldCheck,
							tone: blockingAssets > 0 ? "warning" : "default"
						}),
						canOpenAssets && /* @__PURE__ */ jsx("div", {
							className: "p-3",
							children: /* @__PURE__ */ jsx(Button, {
								variant: "secondary",
								className: "w-full",
								onClick: () => onSectionChange("assets"),
								children: "Review fleet and equipment"
							})
						})
					]
				})]
			})]
		})]
	})] });
}
function DashboardActionRow({ action, onClick }) {
	const Icon = action.icon;
	return /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs("button", {
		type: "button",
		onClick,
		className: "flex min-h-20 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none",
		children: [
			/* @__PURE__ */ jsx("span", {
				className: action.tone === "danger" ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-danger-soft text-danger" : action.tone === "warning" ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning-strong" : "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-info-soft text-info-strong",
				children: /* @__PURE__ */ jsx(Icon, {
					className: "h-5 w-5",
					"aria-hidden": "true"
				})
			}),
			/* @__PURE__ */ jsxs("span", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ jsx("span", {
					className: "block font-semibold text-ink",
					children: action.title
				}), /* @__PURE__ */ jsx("span", {
					className: "mt-0.5 block text-sm leading-5 text-ink-soft",
					children: action.description
				})]
			}),
			/* @__PURE__ */ jsx(ArrowRight, {
				className: "h-4 w-4 shrink-0 text-ink-soft",
				"aria-hidden": "true"
			})
		]
	}) });
}
function ReadinessRow({ label, value, detail, icon: Icon, tone = "default" }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "flex items-center gap-3 px-4 py-3",
		children: [
			/* @__PURE__ */ jsx("span", {
				className: tone === "warning" ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning-strong" : "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-ink-soft",
				children: /* @__PURE__ */ jsx(Icon, {
					className: "h-4 w-4",
					"aria-hidden": "true"
				})
			}),
			/* @__PURE__ */ jsxs("span", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ jsx("span", {
					className: "block text-sm font-medium text-ink",
					children: label
				}), /* @__PURE__ */ jsx("span", {
					className: "mt-0.5 block text-xs leading-5 text-ink-soft",
					children: detail
				})]
			}),
			/* @__PURE__ */ jsx("span", {
				className: "text-xl font-semibold tracking-[-0.02em] tabular-nums",
				children: value
			})
		]
	});
}
function buildDashboardActions({ assets, fuelRequests, locations, approvals, capabilities }) {
	const actions = [];
	const decisionReadyApprovals = approvals.filter((approval) => approval.can_decide);
	const blockedAssets = assets.filter((asset) => asset.blocking_work_orders_count > 0);
	const actionableFuelRequests = fuelRequests.filter((request) => canActOnFuelRequest(request, capabilities));
	const staleLocations = locations.filter((location) => ["stale", "offline"].includes(location.freshness_status));
	if (approvals.length > 0) {
		const canDecideApproval = decisionReadyApprovals.length > 0;
		actions.push({
			title: canDecideApproval ? `${decisionReadyApprovals.length} approval${decisionReadyApprovals.length === 1 ? "" : "s"} need your decision` : `${approvals.length} approval${approvals.length === 1 ? "" : "s"} awaiting independent review`,
			description: canDecideApproval ? "Review the requester, affected work, and consequences before deciding." : approvals[0]?.decision_blocker ?? "An authorized manager must decide this request.",
			section: "approvals",
			icon: ShieldCheck,
			tone: canDecideApproval ? "warning" : "info"
		});
	}
	if (blockedAssets.length > 0) actions.push({
		title: `${blockedAssets.length} asset${blockedAssets.length === 1 ? "" : "s"} blocked from dispatch`,
		description: "Safety evidence or a maintenance release is still required.",
		section: "assets",
		icon: AlertTriangle,
		tone: "danger"
	});
	if (actionableFuelRequests.length > 0) actions.push({
		title: `${actionableFuelRequests.length} fuel request${actionableFuelRequests.length === 1 ? "" : "s"} ready for your step`,
		description: "Continue only the next authorized stage in the fuel workflow.",
		section: "fuel",
		icon: Fuel,
		tone: "info"
	});
	if (staleLocations.length > 0) actions.push({
		title: `${staleLocations.length} location update${staleLocations.length === 1 ? "" : "s"} need review`,
		description: "These records are stale or offline and must not be treated as live location data.",
		section: "tracking",
		icon: MapPin,
		tone: "warning"
	});
	return actions;
}
function canActOnFuelRequest(request, capabilities) {
	return request.status.value === "submitted" && capabilities.forward_fuel || request.status.value === "forwarded" && capabilities.approve_fuel || request.status.value === "approved" && capabilities.verify_fuel || request.status.value === "verified" && capabilities.record_fuel;
}
function formatSchedule(value) {
	if (value === null) return "Schedule pending";
	return new Intl.DateTimeFormat(void 0, {
		weekday: "short",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit"
	}).format(new Date(value));
}
//#endregion
//#region resources/js/components/workspace/live-dispatch-intake.tsx
function LiveDispatchIntake({ clients, serviceRequests, capabilities }) {
	const [mode, setMode] = useState(null);
	return /* @__PURE__ */ jsx("section", {
		className: "border-b border-line bg-surface px-4 py-5 md:px-6",
		"aria-labelledby": "service-request-intake-title",
		children: /* @__PURE__ */ jsxs("div", {
			className: "mx-auto max-w-7xl",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", {
						id: "service-request-intake-title",
						className: "text-lg font-semibold",
						children: "Client and service request intake"
					}), /* @__PURE__ */ jsx("p", {
						className: "mt-1 max-w-3xl text-sm leading-6 text-ink-soft",
						children: "Record demand once, then create as many distinct draft dispatches as staged or rescheduled work requires."
					})] }), /* @__PURE__ */ jsxs("div", {
						className: "flex flex-wrap gap-2",
						children: [capabilities.create_client && /* @__PURE__ */ jsxs(Button, {
							variant: mode === "client" ? "primary" : "secondary",
							onClick: () => setMode((current) => current === "client" ? null : "client"),
							"aria-expanded": mode === "client",
							"aria-controls": "client-intake-form",
							children: [/* @__PURE__ */ jsx(UserRoundPlus, {
								className: "h-4 w-4",
								"aria-hidden": "true"
							}), "Add client"]
						}), capabilities.create_service_request && /* @__PURE__ */ jsxs(Button, {
							variant: mode === "request" ? "primary" : "secondary",
							onClick: () => setMode((current) => current === "request" ? null : "request"),
							"aria-expanded": mode === "request",
							"aria-controls": "service-request-intake-form",
							disabled: clients.length === 0,
							title: clients.length === 0 ? "Create an active client first." : void 0,
							children: [/* @__PURE__ */ jsx(FilePlus2, {
								className: "h-4 w-4",
								"aria-hidden": "true"
							}), "New service request"]
						})]
					})]
				}),
				mode === "client" && /* @__PURE__ */ jsx(ClientIntakeForm, { onClose: () => setMode(null) }),
				mode === "request" && /* @__PURE__ */ jsx(ServiceRequestIntakeForm, {
					clients,
					onClose: () => setMode(null)
				}),
				capabilities.convert_service_request && /* @__PURE__ */ jsx(DispatchConversion, {
					serviceRequests,
					className: mode === null ? "mt-5" : "mt-4"
				})
			]
		})
	});
}
function ClientIntakeForm({ onClose }) {
	const form = useForm({
		code: "",
		company_name: "",
		contact_person: "",
		phone: "",
		email: "",
		address: ""
	});
	const submit = (event) => {
		event.preventDefault();
		form.post("/operations/clients", {
			preserveScroll: true,
			onSuccess: () => {
				form.reset();
				onClose();
			}
		});
	};
	return /* @__PURE__ */ jsxs(Panel, {
		id: "client-intake-form",
		className: "mt-4 p-4",
		children: [/* @__PURE__ */ jsx(FormHeader, {
			title: "New client",
			description: "Create an active client record for service-request selection.",
			onClose
		}), /* @__PURE__ */ jsxs("form", {
			className: "mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3",
			onSubmit: submit,
			noValidate: true,
			children: [
				/* @__PURE__ */ jsx(IntakeInput, {
					id: "client-code",
					label: "Client code",
					value: form.data.code,
					error: form.errors.code,
					onChange: (value) => form.setData("code", value),
					autoComplete: "off",
					required: true
				}),
				/* @__PURE__ */ jsx(IntakeInput, {
					id: "client-company-name",
					label: "Company name",
					value: form.data.company_name,
					error: form.errors.company_name,
					onChange: (value) => form.setData("company_name", value),
					autoComplete: "organization",
					required: true
				}),
				/* @__PURE__ */ jsx(IntakeInput, {
					id: "client-contact-person",
					label: "Contact person",
					value: form.data.contact_person,
					error: form.errors.contact_person,
					onChange: (value) => form.setData("contact_person", value),
					autoComplete: "name"
				}),
				/* @__PURE__ */ jsx(IntakeInput, {
					id: "client-phone",
					label: "Phone",
					type: "tel",
					value: form.data.phone,
					error: form.errors.phone,
					onChange: (value) => form.setData("phone", value),
					autoComplete: "tel"
				}),
				/* @__PURE__ */ jsx(IntakeInput, {
					id: "client-email",
					label: "Email",
					type: "email",
					value: form.data.email,
					error: form.errors.email,
					onChange: (value) => form.setData("email", value),
					autoComplete: "email"
				}),
				/* @__PURE__ */ jsx(IntakeInput, {
					id: "client-address",
					label: "Address",
					value: form.data.address,
					error: form.errors.address,
					onChange: (value) => form.setData("address", value),
					autoComplete: "street-address"
				}),
				/* @__PURE__ */ jsx(FormActions, {
					processing: form.processing,
					processingLabel: "Creating client…",
					submitLabel: "Create client"
				})
			]
		})]
	});
}
function ServiceRequestIntakeForm({ clients, onClose }) {
	const [requirementsText, setRequirementsText] = useState("");
	const form = useForm({
		reference: "",
		client_id: "",
		project_name: "",
		service_type: "",
		location: "",
		site_notes: "",
		scheduled_date: "",
		priority: "routine",
		requirements: []
	});
	const complete = [
		form.data.reference,
		form.data.client_id,
		form.data.project_name,
		form.data.service_type,
		form.data.location
	].every((value) => value.trim() !== "");
	const submit = (event) => {
		event.preventDefault();
		form.transform((data) => ({
			...data,
			requirements: linesFromText(requirementsText)
		}));
		form.post("/operations/service-requests", {
			preserveScroll: true,
			onSuccess: () => {
				form.reset();
				setRequirementsText("");
				onClose();
			}
		});
	};
	return /* @__PURE__ */ jsxs(Panel, {
		id: "service-request-intake-form",
		className: "mt-4 p-4",
		children: [/* @__PURE__ */ jsx(FormHeader, {
			title: "New service request",
			description: "Capture the requested work, schedule, site context, and operational requirements.",
			onClose
		}), /* @__PURE__ */ jsxs("form", {
			className: "mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4",
			onSubmit: submit,
			noValidate: true,
			children: [
				/* @__PURE__ */ jsx(IntakeInput, {
					id: "request-reference",
					label: "Request reference",
					value: form.data.reference,
					error: form.errors.reference,
					onChange: (value) => form.setData("reference", value),
					required: true
				}),
				/* @__PURE__ */ jsxs(SelectField, {
					id: "request-client",
					label: "Client",
					value: form.data.client_id,
					error: form.errors.client_id,
					onChange: (value) => form.setData("client_id", value),
					required: true,
					children: [/* @__PURE__ */ jsx("option", {
						value: "",
						children: "Select an active client"
					}), clients.map((client) => /* @__PURE__ */ jsxs("option", {
						value: client.id,
						children: [
							client.code,
							" · ",
							client.company_name
						]
					}, client.id))]
				}),
				/* @__PURE__ */ jsx(IntakeInput, {
					id: "request-project",
					label: "Project or job name",
					value: form.data.project_name,
					error: form.errors.project_name,
					onChange: (value) => form.setData("project_name", value),
					required: true
				}),
				/* @__PURE__ */ jsx(IntakeInput, {
					id: "request-service-type",
					label: "Service type",
					value: form.data.service_type,
					error: form.errors.service_type,
					onChange: (value) => form.setData("service_type", value),
					placeholder: "e.g. crane and truck",
					required: true
				}),
				/* @__PURE__ */ jsx(IntakeInput, {
					id: "request-location",
					label: "Service location",
					value: form.data.location,
					error: form.errors.location,
					onChange: (value) => form.setData("location", value),
					required: true
				}),
				/* @__PURE__ */ jsx(IntakeInput, {
					id: "request-schedule",
					label: "Requested schedule",
					type: "datetime-local",
					value: form.data.scheduled_date,
					error: form.errors.scheduled_date,
					onChange: (value) => form.setData("scheduled_date", value)
				}),
				/* @__PURE__ */ jsxs(SelectField, {
					id: "request-priority",
					label: "Priority",
					value: form.data.priority,
					error: form.errors.priority,
					onChange: (value) => form.setData("priority", value),
					required: true,
					children: [
						/* @__PURE__ */ jsx("option", {
							value: "routine",
							children: "Routine"
						}),
						/* @__PURE__ */ jsx("option", {
							value: "priority",
							children: "Priority"
						}),
						/* @__PURE__ */ jsx("option", {
							value: "emergency",
							children: "Emergency"
						})
					]
				}),
				/* @__PURE__ */ jsx(TextAreaField, {
					id: "request-requirements",
					label: "Requirements",
					hint: "One requirement per line",
					value: requirementsText,
					error: form.errors.requirements,
					onChange: setRequirementsText
				}),
				/* @__PURE__ */ jsx(TextAreaField, {
					id: "request-site-notes",
					label: "Site notes",
					value: form.data.site_notes,
					error: form.errors.site_notes,
					onChange: (value) => form.setData("site_notes", value),
					className: "md:col-span-2 xl:col-span-3"
				}),
				/* @__PURE__ */ jsx(FormActions, {
					processing: form.processing,
					processingLabel: "Recording request…",
					submitLabel: "Record service request",
					disabled: !complete,
					help: complete ? void 0 : "Complete the client, request, service, and location fields."
				})
			]
		})]
	});
}
function DispatchConversion({ serviceRequests, className }) {
	const form = useForm({
		service_request_id: "",
		reference: "",
		scheduled_start: "",
		scheduled_end: ""
	});
	const selectedRequest = serviceRequests.find((request) => String(request.id) === form.data.service_request_id) ?? null;
	const complete = [
		form.data.service_request_id,
		form.data.reference,
		form.data.scheduled_start,
		form.data.scheduled_end
	].every((value) => value.trim() !== "");
	const chooseRequest = (id) => {
		const start = toLocalDateTime(serviceRequests.find((candidate) => String(candidate.id) === id)?.scheduled_date ?? null);
		form.setData({
			service_request_id: id,
			reference: form.data.reference,
			scheduled_start: start,
			scheduled_end: addHours(start, 4)
		});
	};
	const submit = (event) => {
		event.preventDefault();
		form.post("/operations/dispatch-jobs", {
			preserveScroll: true,
			onSuccess: () => {
				form.reset("reference");
			}
		});
	};
	return /* @__PURE__ */ jsx(Panel, {
		className: cn("overflow-hidden", className),
		children: /* @__PURE__ */ jsxs("div", {
			className: "grid lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "border-b border-line p-4 lg:border-r lg:border-b-0",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-start gap-3",
					children: [/* @__PURE__ */ jsx("div", {
						className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong",
						children: /* @__PURE__ */ jsx(ClipboardCheck, {
							className: "h-5 w-5",
							"aria-hidden": "true"
						})
					}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h3", {
						className: "font-semibold",
						children: "Convert request to draft"
					}), /* @__PURE__ */ jsx("p", {
						className: "mt-1 text-sm leading-6 text-ink-soft",
						children: "Request-owned details are copied as an auditable snapshot. Each additional draft needs a distinct dispatch reference."
					})] })]
				}), selectedRequest ? /* @__PURE__ */ jsxs("div", {
					className: "mt-4 rounded-lg bg-surface-subtle p-3",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [
							/* @__PURE__ */ jsx("p", {
								className: "font-semibold",
								children: selectedRequest.project_name
							}),
							/* @__PURE__ */ jsx(CanonicalStatusBadge, { status: selectedRequest.priority }),
							/* @__PURE__ */ jsx(CanonicalStatusBadge, { status: selectedRequest.status })
						]
					}), /* @__PURE__ */ jsxs("dl", {
						className: "mt-2 divide-y divide-line",
						children: [
							/* @__PURE__ */ jsx(DataPair, {
								label: "Client",
								value: selectedRequest.client.company_name
							}),
							/* @__PURE__ */ jsx(DataPair, {
								label: "Location",
								value: selectedRequest.location
							}),
							/* @__PURE__ */ jsx(DataPair, {
								label: "Drafts",
								value: String(selectedRequest.dispatch_jobs_count)
							})
						]
					})]
				}) : /* @__PURE__ */ jsx("p", {
					className: "mt-4 rounded-lg bg-surface-subtle p-3 text-sm text-ink-soft",
					children: "Select a submitted or dispatching request to review its context."
				})]
			}), serviceRequests.length === 0 ? /* @__PURE__ */ jsx(EmptyState, {
				compact: true,
				icon: CalendarDays,
				title: "No service requests ready",
				message: "Record a service request before creating a linked draft dispatch."
			}) : /* @__PURE__ */ jsxs("form", {
				className: "grid gap-4 p-4 sm:grid-cols-2",
				onSubmit: submit,
				noValidate: true,
				children: [
					/* @__PURE__ */ jsxs(SelectField, {
						id: "conversion-request",
						label: "Service request",
						value: form.data.service_request_id,
						error: form.errors.service_request_id,
						onChange: chooseRequest,
						className: "sm:col-span-2",
						required: true,
						children: [/* @__PURE__ */ jsx("option", {
							value: "",
							children: "Select a service request"
						}), serviceRequests.map((request) => /* @__PURE__ */ jsxs("option", {
							value: request.id,
							children: [
								request.reference,
								" ·",
								" ",
								request.client.company_name,
								" ·",
								" ",
								request.project_name
							]
						}, request.id))]
					}),
					/* @__PURE__ */ jsx(IntakeInput, {
						id: "conversion-reference",
						label: "Dispatch reference",
						value: form.data.reference,
						error: form.errors.reference,
						onChange: (value) => form.setData("reference", value),
						required: true
					}),
					/* @__PURE__ */ jsx("div", {
						className: "hidden sm:block",
						"aria-hidden": "true"
					}),
					/* @__PURE__ */ jsx(IntakeInput, {
						id: "conversion-start",
						label: "Dispatch start",
						type: "datetime-local",
						value: form.data.scheduled_start,
						error: form.errors.scheduled_start,
						onChange: (value) => form.setData("scheduled_start", value),
						required: true
					}),
					/* @__PURE__ */ jsx(IntakeInput, {
						id: "conversion-end",
						label: "Dispatch end",
						type: "datetime-local",
						value: form.data.scheduled_end,
						error: form.errors.scheduled_end,
						onChange: (value) => form.setData("scheduled_end", value),
						required: true
					}),
					/* @__PURE__ */ jsx(FormActions, {
						processing: form.processing,
						processingLabel: "Creating draft…",
						submitLabel: "Create linked draft",
						disabled: !complete,
						help: complete ? void 0 : "Select a request and complete the reference and schedule.",
						className: "sm:col-span-2"
					})
				]
			})]
		})
	});
}
function FormHeader({ title, description, onClose }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "flex items-start justify-between gap-3",
		children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h3", {
			className: "font-semibold",
			children: title
		}), /* @__PURE__ */ jsx("p", {
			className: "mt-1 text-sm text-ink-soft",
			children: description
		})] }), /* @__PURE__ */ jsx(Button, {
			size: "icon",
			variant: "quiet",
			onClick: onClose,
			"aria-label": `Close ${title.toLowerCase()} form`,
			children: /* @__PURE__ */ jsx(X, {
				className: "h-4 w-4",
				"aria-hidden": "true"
			})
		})]
	});
}
function IntakeInput({ id, label, value, error, onChange, className, ...props }) {
	const errorId = `${id}-error`;
	return /* @__PURE__ */ jsxs("label", {
		className: cn("text-sm font-medium text-ink", className),
		children: [
			label,
			/* @__PURE__ */ jsx("input", {
				id,
				value,
				onChange: (event) => onChange(event.target.value),
				"aria-invalid": error ? "true" : void 0,
				"aria-describedby": error ? errorId : void 0,
				className: cn("mt-1 h-11 w-full rounded-lg border bg-surface px-3", error ? "border-danger" : "border-line-strong"),
				...props
			}),
			/* @__PURE__ */ jsx(FieldError, {
				id: errorId,
				error
			})
		]
	});
}
function SelectField({ id, label, value, error, onChange, children, className, required }) {
	const errorId = `${id}-error`;
	return /* @__PURE__ */ jsxs("label", {
		className: cn("text-sm font-medium text-ink", className),
		children: [
			label,
			/* @__PURE__ */ jsx("select", {
				id,
				value,
				onChange: (event) => onChange(event.target.value),
				"aria-invalid": error ? "true" : void 0,
				"aria-describedby": error ? errorId : void 0,
				className: cn("mt-1 h-11 w-full rounded-lg border bg-surface px-3", error ? "border-danger" : "border-line-strong"),
				required,
				children
			}),
			/* @__PURE__ */ jsx(FieldError, {
				id: errorId,
				error
			})
		]
	});
}
function TextAreaField({ id, label, value, error, onChange, hint, className }) {
	const errorId = `${id}-error`;
	const hintId = `${id}-hint`;
	return /* @__PURE__ */ jsxs("label", {
		className: cn("text-sm font-medium text-ink", className),
		children: [
			label,
			hint && /* @__PURE__ */ jsx("span", {
				id: hintId,
				className: "ml-2 text-xs font-normal text-ink-soft",
				children: hint
			}),
			/* @__PURE__ */ jsx("textarea", {
				id,
				value,
				onChange: (event) => onChange(event.target.value),
				rows: 3,
				"aria-invalid": error ? "true" : void 0,
				"aria-describedby": [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || void 0,
				className: cn("mt-1 w-full resize-y rounded-lg border bg-surface px-3 py-2", error ? "border-danger" : "border-line-strong")
			}),
			/* @__PURE__ */ jsx(FieldError, {
				id: errorId,
				error
			})
		]
	});
}
function FieldError({ id, error }) {
	if (!error) return null;
	return /* @__PURE__ */ jsx("span", {
		id,
		className: "mt-1 block text-xs text-danger",
		children: error
	});
}
function FormActions({ processing, processingLabel, submitLabel, disabled = false, help, className }) {
	return /* @__PURE__ */ jsxs("div", {
		className: cn("flex flex-col justify-end self-end", className),
		children: [/* @__PURE__ */ jsx(Button, {
			type: "submit",
			variant: "primary",
			disabled: processing || disabled,
			children: processing ? processingLabel : submitLabel
		}), help && !processing && /* @__PURE__ */ jsx("p", {
			className: "mt-1 text-xs text-ink-soft",
			children: help
		})]
	});
}
function linesFromText(value) {
	return value.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== "");
}
function toLocalDateTime(value) {
	if (value === null) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return (/* @__PURE__ */ new Date(date.getTime() - date.getTimezoneOffset() * 6e4)).toISOString().slice(0, 16);
}
function addHours(value, hours) {
	if (value === "") return "";
	const date = new Date(value);
	date.setHours(date.getHours() + hours);
	return toLocalDateTime(date.toISOString());
}
//#endregion
//#region resources/js/components/workspace/live-dispatch-workspace.tsx
function LiveDispatchWorkspace({ jobs, clients, serviceRequests, assets = [], approvals = [], users = [], gptRecommendations = [], capabilities, canCreate, refreshing }) {
	const [query, setQuery] = useState("");
	const [selectedJobId, setSelectedJobId] = useState(jobs[0]?.id ?? null);
	const [showCreate, setShowCreate] = useState(false);
	const [viewMode, setViewMode] = useState("list");
	const [conflictsOnly, setConflictsOnly] = useState(false);
	const [boardCategory, setBoardCategory] = useState("all");
	const [conflictFilter, setConflictFilter] = useState("all");
	const fieldMode = capabilities.update_assigned_dispatch_status;
	const form = useForm({
		reference: "",
		client: "",
		title: "",
		site: "",
		scheduled_start: "",
		scheduled_end: "",
		priority: "routine",
		requirements: []
	});
	const derivedConflicts = useMemo(() => {
		const conflicts = [];
		const userAssignmentsMap = /* @__PURE__ */ new Map();
		for (const job of jobs) for (const p of job.personnel_assignments) {
			const existing = userAssignmentsMap.get(p.user_id) ?? [];
			existing.push({
				job,
				user_id: p.user_id,
				userName: p.name
			});
			userAssignmentsMap.set(p.user_id, existing);
		}
		for (const [userId, userJobs] of userAssignmentsMap.entries()) {
			if (userJobs.length < 2) continue;
			for (let i = 0; i < userJobs.length; i++) for (let j = i + 1; j < userJobs.length; j++) {
				const a = userJobs[i].job;
				const b = userJobs[j].job;
				if (isOverlapping(a.scheduled_start, a.scheduled_end, b.scheduled_start, b.scheduled_end)) conflicts.push({
					id: `overlap-user-${userId}-${a.id}-${b.id}`,
					type: "overlap",
					severity: "danger",
					title: "Personnel Schedule Overlap",
					description: `${userJobs[i].userName} is assigned to overlapping schedules: ${a.reference} (${a.title}) and ${b.reference} (${b.title}).`,
					actionRequired: `Open job ${a.reference} or ${b.reference} to reassign personnel or adjust scheduled times.`,
					jobId: a.id,
					jobReference: a.reference
				});
			}
		}
		const assetAssignmentsMap = /* @__PURE__ */ new Map();
		for (const job of jobs) for (const a of job.asset_assignments) {
			const id = a.operational_asset_id;
			const existing = assetAssignmentsMap.get(id) ?? [];
			existing.push({
				job,
				assetCode: a.code,
				assetName: a.name,
				assetId: id
			});
			assetAssignmentsMap.set(id, existing);
		}
		for (const [assetId, assetJobs] of assetAssignmentsMap.entries()) {
			if (assetJobs.length < 2) continue;
			for (let i = 0; i < assetJobs.length; i++) for (let j = i + 1; j < assetJobs.length; j++) {
				const a = assetJobs[i].job;
				const b = assetJobs[j].job;
				if (isOverlapping(a.scheduled_start, a.scheduled_end, b.scheduled_start, b.scheduled_end)) conflicts.push({
					id: `overlap-asset-${assetId}-${a.id}-${b.id}`,
					type: "overlap",
					severity: "danger",
					title: "Asset Schedule Overlap",
					description: `Asset ${assetJobs[i].assetCode} (${assetJobs[i].assetName}) is assigned to overlapping schedules: ${a.reference} and ${b.reference}.`,
					actionRequired: `Open job ${a.reference} or ${b.reference} to reassign asset.`,
					jobId: a.id,
					jobReference: a.reference
				});
			}
		}
		for (const job of jobs) for (const assetAssign of job.asset_assignments) {
			const assetId = assetAssign.operational_asset_id;
			const realAsset = assets.find((ast) => ast.id === assetId || ast.code === assetAssign.code);
			if (realAsset && (realAsset.blocking_work_orders_count > 0 || !realAsset.is_dispatchable || realAsset.status.value === "under_maintenance" || realAsset.status.value === "under_inspection")) conflicts.push({
				id: `maint-asset-${job.id}-${assetAssign.code}`,
				type: "maintenance",
				severity: "danger",
				title: "Blocked Asset Assigned",
				description: `Job ${job.reference} is assigned asset ${assetAssign.code} (${assetAssign.name}), which is blocked by maintenance (${realAsset.blocking_work_orders_count} work order) or unpassed inspection.`,
				actionRequired: `Release maintenance work order or replace assigned asset on ${job.reference}.`,
				jobId: job.id,
				jobReference: job.reference
			});
		}
		for (const approval of approvals) if (approval.status.value === "pending") conflicts.push({
			id: `approval-${approval.id}`,
			type: "approval",
			severity: "warning",
			title: `Pending Approval: ${humanize$1(approval.kind)}`,
			description: `Exceptional request for ${approval.subject.reference} (${approval.subject.title ?? "Dispatch"}) submitted by ${approval.requester.name}.`,
			actionRequired: approval.can_decide ? "Review requested resource changes and decide approval below." : approval.decision_blocker ?? "Your operational role cannot decide this approval request.",
			approvalId: approval.id,
			canDecide: approval.can_decide,
			decisionBlocker: approval.decision_blocker,
			jobId: typeof approval.subject.id === "number" ? approval.subject.id : void 0,
			jobReference: approval.subject.reference
		});
		for (const job of jobs) for (const assignment of job.personnel_assignments) if (assignment.response_status.value === "rejected") conflicts.push({
			id: `response-rejected-${job.id}-${assignment.id}`,
			type: "response",
			severity: "danger",
			title: "Assignment Response Rejected",
			description: `${assignment.name} rejected assignment on ${job.reference}. Reason: "${assignment.response_reason || "No reason specified"}"`,
			actionRequired: `Reassign role in job assignment workspace.`,
			jobId: job.id,
			jobReference: job.reference
		});
		for (const job of jobs) if ((job.status.value === "draft" || job.status.value === "pending_approval") && job.personnel_assignments.length === 0 && job.asset_assignments.length === 0) conflicts.push({
			id: `unassigned-${job.id}`,
			type: "unassigned",
			severity: "info",
			title: "Missing Resource Assignments",
			description: `Job ${job.reference} (${job.title}) has no personnel or assets assigned yet.`,
			actionRequired: `Open assignment workspace to select qualified candidates.`,
			jobId: job.id,
			jobReference: job.reference
		});
		for (const rec of gptRecommendations) if (rec.status === "pending_review" && !rec.is_expired && rec.conflicts.length > 0) conflicts.push({
			id: `gpt-rec-${rec.id}`,
			type: "unassigned",
			severity: "info",
			title: "GPT Recommendation Advisory Note",
			description: `AI dispatch recommendation #${rec.id} reported ${rec.conflicts.length} potential constraint note(s).`,
			actionRequired: "Review advisory recommendation notes in dispatch workflow."
		});
		return conflicts;
	}, [
		jobs,
		assets,
		approvals,
		gptRecommendations
	]);
	const filteredJobs = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		if (normalized === "") return jobs;
		return jobs.filter((job) => `${job.reference} ${job.client} ${job.title} ${job.site}`.toLowerCase().includes(normalized));
	}, [jobs, query]);
	const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null;
	const formComplete = [
		form.data.reference,
		form.data.client,
		form.data.title,
		form.data.site,
		form.data.scheduled_start,
		form.data.scheduled_end
	].every((value) => value.trim() !== "");
	const submit = (event) => {
		event.preventDefault();
		form.post("/operations/dispatch-jobs", {
			preserveScroll: true,
			onSuccess: () => {
				form.reset();
				setShowCreate(false);
			}
		});
	};
	return /* @__PURE__ */ jsxs("div", { children: [
		/* @__PURE__ */ jsx(PageHeading, {
			title: fieldMode ? "Today's assigned work" : "Dispatch workspace",
			description: fieldMode ? "Review the jobs actively assigned to you, then open one to record only its next valid field milestone." : "Review live jobs, schedule board, and operational conflicts. Laravel remains authoritative for every visible record and write.",
			actions: /* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [!fieldMode && /* @__PURE__ */ jsxs("div", {
					className: "inline-flex rounded-lg border border-line bg-surface p-1",
					role: "group",
					"aria-label": "Workspace views",
					children: [
						/* @__PURE__ */ jsxs("button", {
							type: "button",
							"aria-pressed": viewMode === "list",
							onClick: () => setViewMode("list"),
							className: cn("inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors", viewMode === "list" ? "bg-brand text-white shadow-xs" : "text-ink-soft hover:bg-surface-subtle hover:text-ink"),
							children: [/* @__PURE__ */ jsx(ClipboardList, {
								className: "h-3.5 w-3.5",
								"aria-hidden": "true"
							}), "Dispatches"]
						}),
						/* @__PURE__ */ jsxs("button", {
							type: "button",
							"aria-pressed": viewMode === "board",
							onClick: () => setViewMode("board"),
							className: cn("inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors", viewMode === "board" ? "bg-brand text-white shadow-xs" : "text-ink-soft hover:bg-surface-subtle hover:text-ink"),
							children: [/* @__PURE__ */ jsx(CalendarDays, {
								className: "h-3.5 w-3.5",
								"aria-hidden": "true"
							}), "Schedule board"]
						}),
						/* @__PURE__ */ jsxs("button", {
							type: "button",
							"aria-pressed": viewMode === "conflicts",
							onClick: () => setViewMode("conflicts"),
							className: cn("inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors", viewMode === "conflicts" ? "bg-brand text-white shadow-xs" : "text-ink-soft hover:bg-surface-subtle hover:text-ink"),
							children: [
								/* @__PURE__ */ jsx(AlertTriangle, {
									className: "h-3.5 w-3.5",
									"aria-hidden": "true"
								}),
								"Conflicts",
								derivedConflicts.length > 0 && /* @__PURE__ */ jsx("span", {
									className: "ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white",
									children: derivedConflicts.length
								})
							]
						})
					]
				}), canCreate && /* @__PURE__ */ jsxs(Button, {
					variant: showCreate ? "secondary" : "primary",
					onClick: () => setShowCreate((value) => !value),
					"aria-expanded": showCreate,
					"aria-controls": "create-dispatch-panel",
					children: [/* @__PURE__ */ jsx(Plus, {
						className: "h-4 w-4",
						"aria-hidden": "true"
					}), showCreate ? "Close form" : "Create dispatch"]
				})]
			})
		}),
		(capabilities.create_client || capabilities.create_service_request || capabilities.convert_service_request) && /* @__PURE__ */ jsx(LiveDispatchIntake, {
			clients,
			serviceRequests,
			capabilities
		}),
		showCreate && canCreate && /* @__PURE__ */ jsxs("section", {
			id: "create-dispatch-panel",
			className: "border-b border-line bg-surface px-4 py-5 md:px-6",
			"aria-labelledby": "create-dispatch-title",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "mb-4",
				children: [/* @__PURE__ */ jsx("h2", {
					id: "create-dispatch-title",
					className: "text-lg font-semibold",
					children: "New dispatch"
				}), /* @__PURE__ */ jsx("p", {
					className: "mt-1 text-sm text-ink-soft",
					children: "Create the live draft first. Assignment and activation stay in their existing authorized workflows."
				})]
			}), /* @__PURE__ */ jsxs("form", {
				onSubmit: submit,
				className: "grid gap-4 lg:grid-cols-4",
				noValidate: true,
				children: [
					/* @__PURE__ */ jsx(DispatchInput, {
						label: "Reference",
						value: form.data.reference,
						error: form.errors.reference,
						onChange: (value) => form.setData("reference", value)
					}),
					/* @__PURE__ */ jsx(DispatchInput, {
						label: "Client",
						value: form.data.client,
						error: form.errors.client,
						onChange: (value) => form.setData("client", value)
					}),
					/* @__PURE__ */ jsx(DispatchInput, {
						label: "Job title",
						value: form.data.title,
						error: form.errors.title,
						onChange: (value) => form.setData("title", value)
					}),
					/* @__PURE__ */ jsx(DispatchInput, {
						label: "Site",
						value: form.data.site,
						error: form.errors.site,
						onChange: (value) => form.setData("site", value)
					}),
					/* @__PURE__ */ jsx(DispatchInput, {
						label: "Start",
						type: "datetime-local",
						value: form.data.scheduled_start,
						error: form.errors.scheduled_start,
						onChange: (value) => form.setData("scheduled_start", value)
					}),
					/* @__PURE__ */ jsx(DispatchInput, {
						label: "End",
						type: "datetime-local",
						value: form.data.scheduled_end,
						error: form.errors.scheduled_end,
						onChange: (value) => form.setData("scheduled_end", value)
					}),
					/* @__PURE__ */ jsxs("label", {
						className: "text-sm font-medium text-ink",
						children: [
							"Priority",
							/* @__PURE__ */ jsxs("select", {
								value: form.data.priority,
								onChange: (event) => form.setData("priority", event.target.value),
								"aria-invalid": form.errors.priority ? "true" : void 0,
								className: cn("mt-1 h-11 w-full rounded-lg border bg-surface px-3", form.errors.priority ? "border-danger" : "border-line-strong"),
								children: [
									/* @__PURE__ */ jsx("option", {
										value: "routine",
										children: "Routine"
									}),
									/* @__PURE__ */ jsx("option", {
										value: "priority",
										children: "Priority"
									}),
									/* @__PURE__ */ jsx("option", {
										value: "emergency",
										children: "Emergency"
									})
								]
							}),
							form.errors.priority && /* @__PURE__ */ jsx("span", {
								className: "mt-1 block text-xs text-danger",
								children: form.errors.priority
							})
						]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex flex-col justify-end",
						children: [/* @__PURE__ */ jsx(Button, {
							type: "submit",
							variant: "primary",
							disabled: form.processing || !formComplete,
							children: form.processing ? "Creating dispatch…" : "Create live draft"
						}), !formComplete && !form.processing && /* @__PURE__ */ jsx("p", {
							className: "mt-1 text-xs text-ink-soft",
							children: "Complete every required field to continue."
						})]
					})
				]
			})]
		}),
		viewMode === "board" && !fieldMode && /* @__PURE__ */ jsxs("section", {
			className: "p-4 md:p-6",
			"aria-label": "Schedule board section",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "mb-4 flex flex-wrap items-center justify-between gap-3",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [/* @__PURE__ */ jsxs("label", {
						className: "relative block",
						children: [
							/* @__PURE__ */ jsx("span", {
								className: "sr-only",
								children: "Filter board"
							}),
							/* @__PURE__ */ jsx(Search, {
								className: "pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-soft",
								"aria-hidden": "true"
							}),
							/* @__PURE__ */ jsx("input", {
								type: "search",
								value: query,
								onChange: (event) => setQuery(event.target.value),
								placeholder: "Filter jobs or resources",
								className: "h-11 w-64 rounded-lg border border-line-strong bg-surface pr-3 pl-9 text-xs placeholder:text-ink-soft"
							})
						]
					}), /* @__PURE__ */ jsx("div", {
						className: "flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1",
						children: [
							"all",
							"cranes",
							"trucks",
							"equipment",
							"personnel"
						].map((cat) => /* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => setBoardCategory(cat),
							className: cn("rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors", boardCategory === cat ? "bg-brand-soft font-semibold text-brand-strong" : "text-ink-soft hover:bg-surface-subtle hover:text-ink"),
							children: cat
						}, cat))
					})]
				}), /* @__PURE__ */ jsx("div", {
					className: "flex items-center gap-2",
					children: /* @__PURE__ */ jsxs(Button, {
						size: "sm",
						variant: conflictsOnly ? "primary" : "secondary",
						onClick: () => setConflictsOnly((prev) => !prev),
						"aria-pressed": conflictsOnly,
						children: [/* @__PURE__ */ jsx(AlertTriangle, {
							className: "h-4 w-4",
							"aria-hidden": "true"
						}), "Conflicts only"]
					})
				})]
			}), /* @__PURE__ */ jsx(ScheduleBoardTable, {
				jobs: filteredJobs,
				assets,
				users,
				derivedConflicts,
				category: boardCategory,
				conflictsOnly,
				onSelectJob: (id) => {
					setSelectedJobId(id);
					setViewMode("list");
				}
			})]
		}),
		viewMode === "conflicts" && !fieldMode && /* @__PURE__ */ jsxs("section", {
			className: "p-4 md:p-6",
			"aria-label": "Conflict review section",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4",
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", {
					className: "text-lg font-semibold tracking-[-0.02em]",
					children: "Operational conflict review"
				}), /* @__PURE__ */ jsx("p", {
					className: "mt-0.5 text-xs text-ink-soft",
					children: "Server-derived schedule overlaps, maintenance blockers, and required manager approvals."
				})] }), /* @__PURE__ */ jsx("div", {
					className: "flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1",
					children: [
						"all",
						"overlaps",
						"maintenance",
						"approvals",
						"responses",
						"unassigned"
					].map((filter) => /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => setConflictFilter(filter),
						className: cn("rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors", conflictFilter === filter ? "bg-brand-soft font-semibold text-brand-strong" : "text-ink-soft hover:bg-surface-subtle hover:text-ink"),
						children: filter
					}, filter))
				})]
			}), /* @__PURE__ */ jsx(ConflictReviewList, {
				conflicts: derivedConflicts,
				filter: conflictFilter
			})]
		}),
		(viewMode === "list" || fieldMode) && /* @__PURE__ */ jsxs("div", {
			className: cn("min-h-[calc(100vh-9rem)]", !fieldMode && "grid lg:grid-cols-[19rem_minmax(0,1fr)]"),
			children: [/* @__PURE__ */ jsxs("aside", {
				className: cn("border-b border-line bg-surface", fieldMode ? "mx-auto w-full max-w-5xl" : "lg:border-r lg:border-b-0"),
				children: [/* @__PURE__ */ jsxs("div", {
					className: "border-b border-line p-4",
					children: [/* @__PURE__ */ jsxs("label", {
						className: "relative block",
						children: [
							/* @__PURE__ */ jsx("span", {
								className: "sr-only",
								children: fieldMode ? "Search assigned jobs" : "Search live dispatches"
							}),
							/* @__PURE__ */ jsx(Search, {
								className: "pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-soft",
								"aria-hidden": "true"
							}),
							/* @__PURE__ */ jsx("input", {
								type: "search",
								value: query,
								onChange: (event) => setQuery(event.target.value),
								placeholder: fieldMode ? "Search assigned jobs" : "Search jobs, clients, sites",
								className: "h-11 w-full rounded-lg border border-line-strong bg-surface-subtle pr-3 pl-9 text-sm placeholder:text-ink-soft"
							})
						]
					}), /* @__PURE__ */ jsx("p", {
						className: "mt-2 text-xs text-ink-soft",
						role: "status",
						children: refreshing ? "Refreshing live jobs…" : `${filteredJobs.length} of ${jobs.length} jobs`
					})]
				}), refreshing ? /* @__PURE__ */ jsx(DispatchListSkeleton, {}) : filteredJobs.length === 0 ? query.trim() === "" ? /* @__PURE__ */ jsx(EmptyState, {
					compact: true,
					icon: ClipboardList,
					title: fieldMode ? "No assigned jobs today" : "No dispatch jobs available",
					message: canCreate ? "Create a live draft to begin the dispatch workflow." : "Jobs assigned or visible to your account will appear here.",
					primaryAction: canCreate ? /* @__PURE__ */ jsx(Button, {
						variant: "primary",
						onClick: () => setShowCreate(true),
						children: "Create dispatch"
					}) : void 0
				}) : /* @__PURE__ */ jsx(EmptyState, {
					compact: true,
					icon: SearchX,
					title: "No matching dispatches",
					message: "Try a reference, client, title, or site.",
					primaryAction: /* @__PURE__ */ jsx(Button, {
						variant: "secondary",
						onClick: () => setQuery(""),
						children: "Clear search"
					})
				}) : /* @__PURE__ */ jsx("ul", {
					className: "divide-y divide-line",
					children: filteredJobs.map((job) => {
						const hasConflict = derivedConflicts.filter((c) => c.jobId === job.id).length > 0;
						return /* @__PURE__ */ jsxs("li", { children: [fieldMode && /* @__PURE__ */ jsxs(Link, {
							href: `/operations/dispatch-jobs/${job.id}`,
							className: "flex min-h-24 w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-subtle",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "min-w-0 flex-1",
								children: [
									/* @__PURE__ */ jsxs("div", {
										className: "flex items-start justify-between gap-2",
										children: [/* @__PURE__ */ jsx("p", {
											className: "font-semibold",
											children: job.reference
										}), /* @__PURE__ */ jsx(CanonicalStatusBadge, { status: job.priority })]
									}),
									/* @__PURE__ */ jsx("p", {
										className: "mt-1 truncate text-sm",
										children: job.title
									}),
									/* @__PURE__ */ jsxs("p", {
										className: "mt-1 truncate text-xs text-ink-soft",
										children: [
											job.client,
											" —",
											" ",
											formatDateTime$1(job.scheduled_start)
										]
									})
								]
							}), /* @__PURE__ */ jsx(ChevronRight, {
								className: "mt-1 h-4 w-4 shrink-0 text-ink-soft",
								"aria-hidden": "true"
							})]
						}), !fieldMode && /* @__PURE__ */ jsxs("button", {
							type: "button",
							onClick: () => setSelectedJobId(job.id),
							className: cn("flex min-h-24 w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-subtle", job.id === selectedJob?.id && "bg-brand-soft"),
							"aria-current": job.id === selectedJob?.id ? "true" : void 0,
							children: [/* @__PURE__ */ jsxs("div", {
								className: "min-w-0 flex-1",
								children: [
									/* @__PURE__ */ jsxs("div", {
										className: "flex items-start justify-between gap-2",
										children: [/* @__PURE__ */ jsxs("div", {
											className: "flex items-center gap-1.5",
											children: [/* @__PURE__ */ jsx("p", {
												className: "font-semibold",
												children: job.reference
											}), hasConflict && /* @__PURE__ */ jsx(AlertTriangle, {
												className: "h-3.5 w-3.5 shrink-0 text-danger",
												"aria-label": "Job has active operational conflict"
											})]
										}), /* @__PURE__ */ jsx(CanonicalStatusBadge, { status: job.priority })]
									}),
									/* @__PURE__ */ jsx("p", {
										className: "mt-1 truncate text-sm",
										children: job.title
									}),
									/* @__PURE__ */ jsxs("p", {
										className: "mt-1 truncate text-xs text-ink-soft",
										children: [
											job.client,
											" ·",
											" ",
											formatDateTime$1(job.scheduled_start)
										]
									})
								]
							}), /* @__PURE__ */ jsx(ChevronRight, {
								className: "mt-1 h-4 w-4 shrink-0 text-ink-soft",
								"aria-hidden": "true"
							})]
						})] }, job.id);
					})
				})]
			}), !fieldMode && /* @__PURE__ */ jsx("section", {
				className: "min-w-0 bg-canvas p-4 md:p-6",
				children: selectedJob ? /* @__PURE__ */ jsx(DispatchDetails, {
					job: selectedJob,
					conflicts: derivedConflicts.filter((c) => c.jobId === selectedJob.id)
				}) : /* @__PURE__ */ jsx(Panel, { children: /* @__PURE__ */ jsx(EmptyState, {
					icon: ClipboardList,
					title: "Select a dispatch",
					message: "Choose a live job from the list to review its schedule, site, and assignments."
				}) })
			})]
		})
	] });
}
function ScheduleBoardTable({ jobs, assets, users, derivedConflicts, category, conflictsOnly, onSelectJob }) {
	const hours = Array.from({ length: 11 }, (_, i) => i + 7);
	const rows = useMemo(() => {
		const resourceRows = [];
		for (const asset of assets) {
			const kindLower = (asset.kind || "").toLowerCase();
			let cat = "equipment";
			if (kindLower.includes("crane")) cat = "cranes";
			else if (kindLower.includes("truck") || kindLower.includes("vehicle")) cat = "trucks";
			if (category !== "all" && category !== cat) continue;
			const assignedJobsForAsset = [];
			for (const job of jobs) if (job.asset_assignments.some((a) => a.operational_asset_id === asset.id || a.code === asset.code)) {
				const span = calculateTimeSpan(job.scheduled_start, job.scheduled_end);
				assignedJobsForAsset.push({
					job,
					...span
				});
			}
			const hasConflict = derivedConflicts.filter((c) => c.description.includes(asset.code) || assignedJobsForAsset.some((aj) => aj.job.id === c.jobId)).length > 0;
			if (conflictsOnly && !hasConflict) continue;
			resourceRows.push({
				id: `asset-${asset.id}`,
				code: asset.code,
				name: asset.name,
				category: cat,
				statusLabel: asset.status.label,
				statusTone: asset.blocking_work_orders_count > 0 ? "error" : asset.is_dispatchable ? "success" : "warning",
				jobAssignments: assignedJobsForAsset,
				hasConflict
			});
		}
		if (category === "all" || category === "personnel") for (const user of users) {
			const assignedJobsForUser = [];
			for (const job of jobs) if (job.personnel_assignments.some((p) => p.user_id === user.id)) {
				const span = calculateTimeSpan(job.scheduled_start, job.scheduled_end);
				assignedJobsForUser.push({
					job,
					...span
				});
			}
			const hasConflict = derivedConflicts.filter((c) => c.description.includes(user.name) || assignedJobsForUser.some((uj) => uj.job.id === c.jobId)).length > 0;
			if (conflictsOnly && !hasConflict) continue;
			if (assignedJobsForUser.length > 0 || category === "personnel") resourceRows.push({
				id: `user-${user.id}`,
				code: user.role_label ?? "Personnel",
				name: user.name,
				category: "personnel",
				statusLabel: user.is_active ? "Active" : "Inactive",
				statusTone: user.is_active ? "success" : "error",
				jobAssignments: assignedJobsForUser,
				hasConflict
			});
		}
		return resourceRows;
	}, [
		assets,
		users,
		jobs,
		category,
		conflictsOnly,
		derivedConflicts
	]);
	return /* @__PURE__ */ jsx(Panel, {
		className: "overflow-hidden",
		children: /* @__PURE__ */ jsx("div", {
			className: "overflow-x-auto",
			children: /* @__PURE__ */ jsxs("div", {
				className: "min-w-[64rem]",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "grid grid-cols-[16rem_minmax(48rem,1fr)] border-b border-line bg-surface-subtle text-xs font-semibold",
					children: [/* @__PURE__ */ jsx("div", {
						className: "border-r border-line px-4 py-3 text-ink",
						children: "Resource & Status"
					}), /* @__PURE__ */ jsx("div", {
						className: "grid grid-cols-11 divide-x divide-line",
						children: hours.map((h) => /* @__PURE__ */ jsx("div", {
							className: "px-2 py-3 text-center text-ink-soft",
							children: h > 12 ? `${h - 12} PM` : h === 12 ? "12 PM" : `${h} AM`
						}, h))
					})]
				}), rows.length === 0 ? /* @__PURE__ */ jsx(EmptyState, {
					compact: true,
					icon: SearchX,
					title: "No scheduled resources found",
					message: conflictsOnly ? "No resources have active conflict warnings." : "Try adjusting the search query or category filter."
				}) : /* @__PURE__ */ jsx("div", {
					className: "divide-y divide-line",
					children: rows.map((row) => /* @__PURE__ */ jsxs("div", {
						className: "grid grid-cols-[16rem_minmax(48rem,1fr)] items-stretch hover:bg-surface-subtle/50",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "flex items-center justify-between border-r border-line px-4 py-3",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "min-w-0 flex-1 pr-2",
								children: [/* @__PURE__ */ jsxs("div", {
									className: "flex items-center gap-1.5",
									children: [/* @__PURE__ */ jsx("p", {
										className: "truncate text-xs font-semibold text-ink",
										children: row.name
									}), row.hasConflict && /* @__PURE__ */ jsx(AlertTriangle, {
										className: "h-3.5 w-3.5 shrink-0 text-danger",
										"aria-label": "Conflict on resource"
									})]
								}), /* @__PURE__ */ jsx("p", {
									className: "mt-0.5 text-[11px] text-ink-soft",
									children: row.code
								})]
							}), /* @__PURE__ */ jsx("span", {
								className: cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", row.statusTone === "success" && "bg-success-soft text-success-strong", row.statusTone === "warning" && "bg-warning-soft text-warning-strong", row.statusTone === "error" && "bg-danger-soft text-danger"),
								children: row.statusLabel
							})]
						}), /* @__PURE__ */ jsx("div", {
							className: "relative grid grid-cols-11 divide-x divide-line bg-canvas/30 p-1",
							children: row.jobAssignments.map(({ job, startCol, colSpan }) => /* @__PURE__ */ jsxs("button", {
								type: "button",
								onClick: () => onSelectJob(job.id),
								style: {
									gridColumnStart: startCol,
									gridColumnEnd: `span ${colSpan}`
								},
								className: cn("z-10 flex flex-col justify-center rounded-lg border px-2 py-1.5 text-left shadow-xs transition-all hover:scale-[1.01] hover:shadow-md", job.priority.value === "emergency" ? "border-danger bg-danger-soft text-danger" : job.priority.value === "priority" ? "border-warning bg-warning-soft text-warning-strong" : "border-brand bg-brand-soft text-brand-strong"),
								title: `${job.reference}: ${job.title} (${job.client})`,
								children: [/* @__PURE__ */ jsxs("div", {
									className: "flex items-center justify-between gap-1",
									children: [/* @__PURE__ */ jsx("span", {
										className: "text-[11px] font-bold tracking-tight",
										children: job.reference
									}), /* @__PURE__ */ jsx(CanonicalStatusBadge, { status: job.priority })]
								}), /* @__PURE__ */ jsx("p", {
									className: "truncate text-[10px] leading-tight font-medium",
									children: job.title
								})]
							}, `${row.id}-job-${job.id}`))
						})]
					}, row.id))
				})]
			})
		})
	});
}
function ConflictReviewList({ conflicts, filter }) {
	const filtered = useMemo(() => {
		if (filter === "all") return conflicts;
		if (filter === "overlaps") return conflicts.filter((c) => c.type === "overlap");
		if (filter === "maintenance") return conflicts.filter((c) => c.type === "maintenance");
		if (filter === "approvals") return conflicts.filter((c) => c.type === "approval");
		if (filter === "responses") return conflicts.filter((c) => c.type === "response");
		if (filter === "unassigned") return conflicts.filter((c) => c.type === "unassigned");
		return conflicts;
	}, [conflicts, filter]);
	if (filtered.length === 0) return /* @__PURE__ */ jsx(Panel, {
		className: "p-6",
		children: /* @__PURE__ */ jsx(EmptyState, {
			icon: ShieldCheck,
			title: "All schedule and resource checks clear",
			message: "No active schedule overlaps, maintenance blockers, or pending manager approvals were found."
		})
	});
	return /* @__PURE__ */ jsx("div", {
		className: "space-y-4",
		children: filtered.map((conflict) => /* @__PURE__ */ jsx(Panel, {
			className: "p-4 md:p-5",
			children: /* @__PURE__ */ jsxs("div", {
				className: "flex flex-col gap-4 md:flex-row md:items-start md:justify-between",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex min-w-0 items-start gap-3.5",
					children: [/* @__PURE__ */ jsx("div", {
						className: cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", conflict.severity === "danger" && "bg-danger-soft text-danger", conflict.severity === "warning" && "bg-warning-soft text-warning-strong", conflict.severity === "info" && "bg-info-soft text-info-strong"),
						children: /* @__PURE__ */ jsx(AlertTriangle, {
							className: "h-5 w-5",
							"aria-hidden": "true"
						})
					}), /* @__PURE__ */ jsxs("div", {
						className: "min-w-0",
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "flex flex-wrap items-center gap-2",
								children: [/* @__PURE__ */ jsx("h3", {
									className: "text-base font-semibold text-ink",
									children: conflict.title
								}), /* @__PURE__ */ jsx("span", {
									className: cn("rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", conflict.severity === "danger" && "bg-danger-soft text-danger", conflict.severity === "warning" && "bg-warning-soft text-warning-strong", conflict.severity === "info" && "bg-info-soft text-info-strong"),
									children: conflict.severity
								})]
							}),
							/* @__PURE__ */ jsx("p", {
								className: "mt-1 text-sm leading-relaxed text-ink-soft",
								children: conflict.description
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "mt-3 rounded-lg bg-surface-subtle px-3 py-2 text-xs font-medium text-ink",
								children: [/* @__PURE__ */ jsxs("span", {
									className: "font-bold text-ink-soft",
									children: ["Required action:", " "]
								}), conflict.actionRequired]
							})
						]
					})]
				}), /* @__PURE__ */ jsxs("div", {
					className: "flex shrink-0 flex-wrap items-center gap-2 self-end md:self-start",
					children: [conflict.type === "approval" && conflict.approvalId && (conflict.canDecide ? /* @__PURE__ */ jsx(ApprovalConflictActions, { approvalId: conflict.approvalId }) : /* @__PURE__ */ jsx("p", {
						className: "rounded-md bg-danger-soft px-3 py-1.5 text-xs font-medium text-danger",
						children: conflict.decisionBlocker
					})), conflict.jobId && /* @__PURE__ */ jsxs(Link, {
						href: `/operations/dispatch-jobs/${conflict.jobId}`,
						className: "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-xs font-semibold text-ink transition-colors hover:bg-surface-subtle",
						children: ["Open assignment workspace", /* @__PURE__ */ jsx(ChevronRight, {
							className: "h-3.5 w-3.5",
							"aria-hidden": "true"
						})]
					})]
				})]
			})
		}, conflict.id))
	});
}
function ApprovalConflictActions({ approvalId }) {
	const form = useForm({
		status: "approved",
		reason: ""
	});
	const [pendingDecision, setPendingDecision] = useState(null);
	const reasonId = `conflict-approval-${approvalId}-reason`;
	const errorId = `${reasonId}-error`;
	const approvalError = form.errors.approval ?? form.errors.version ?? form.errors.personnel ?? form.errors.assets ?? null;
	const decide = (status) => {
		form.transform((data) => ({
			...data,
			status
		}));
		form.post(`/operations/approval-requests/${approvalId}/decision`, {
			preserveScroll: true,
			onStart: () => setPendingDecision(status),
			onFinish: () => setPendingDecision(null)
		});
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "w-full rounded-lg border border-line bg-surface-subtle p-3 md:max-w-md md:min-w-80",
		children: [
			approvalError && /* @__PURE__ */ jsx("div", {
				className: "mb-3 rounded-lg border border-danger bg-danger-soft px-3 py-3 text-xs text-danger",
				role: "alert",
				children: approvalError
			}),
			/* @__PURE__ */ jsx("label", {
				htmlFor: reasonId,
				className: "text-xs font-semibold text-ink",
				children: "Decision reason"
			}),
			/* @__PURE__ */ jsx("p", {
				className: "mt-1 text-xs leading-5 text-ink-soft",
				children: "Required for approval or rejection and recorded in the audit history."
			}),
			/* @__PURE__ */ jsx("textarea", {
				id: reasonId,
				value: form.data.reason,
				onChange: (event) => form.setData("reason", event.target.value),
				rows: 3,
				required: true,
				maxLength: 2e3,
				"aria-invalid": form.errors.reason ? "true" : void 0,
				"aria-describedby": form.errors.reason ? errorId : void 0,
				className: cn("mt-2 w-full resize-y rounded-lg border bg-surface px-3 py-2 text-sm", form.errors.reason ? "border-danger" : "border-line-strong")
			}),
			form.errors.reason && /* @__PURE__ */ jsx("p", {
				id: errorId,
				className: "mt-1 text-xs text-danger",
				role: "alert",
				children: form.errors.reason
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mt-3 flex flex-wrap justify-end gap-2",
				children: [/* @__PURE__ */ jsx(Button, {
					size: "sm",
					variant: "secondary",
					type: "button",
					disabled: form.processing || form.data.reason.trim().length === 0,
					onClick: () => decide("rejected"),
					children: form.processing && pendingDecision === "rejected" ? "Rejecting…" : "Reject request"
				}), /* @__PURE__ */ jsx(Button, {
					size: "sm",
					variant: "primary",
					type: "button",
					disabled: form.processing || form.data.reason.trim().length === 0,
					onClick: () => decide("approved"),
					children: form.processing && pendingDecision === "approved" ? "Approving…" : "Approve request"
				})]
			})
		]
	});
}
function DispatchDetails({ job, conflicts = [] }) {
	const assignments = [...job.personnel_assignments.map((assignment) => ({
		id: `person-${assignment.id}`,
		primary: assignment.name,
		secondary: humanize$1(assignment.type),
		icon: UserRound
	})), ...job.asset_assignments.map((assignment) => ({
		id: `asset-${assignment.id}`,
		primary: `${assignment.code} · ${assignment.name}`,
		secondary: humanize$1(assignment.type),
		icon: ClipboardList
	}))];
	return /* @__PURE__ */ jsxs("div", {
		className: "mx-auto max-w-5xl space-y-4",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-start sm:justify-between",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "min-w-0",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [/* @__PURE__ */ jsx("h2", {
							className: "text-xl font-semibold tracking-[-0.02em]",
							children: job.title
						}), /* @__PURE__ */ jsx(CanonicalStatusBadge, { status: job.status })]
					}), /* @__PURE__ */ jsxs("p", {
						className: "mt-1 text-sm text-ink-soft",
						children: [
							job.reference,
							" · ",
							job.client
						]
					})]
				}), /* @__PURE__ */ jsxs("div", {
					className: "flex flex-wrap gap-2",
					children: [
						/* @__PURE__ */ jsx(CanonicalStatusBadge, { status: job.priority }),
						/* @__PURE__ */ jsxs("span", {
							className: "inline-flex min-h-6 items-center rounded-full bg-surface-subtle px-2.5 py-0.5 text-xs font-medium text-ink-soft",
							children: ["Version ", job.version]
						}),
						/* @__PURE__ */ jsxs(Link, {
							href: `/operations/dispatch-jobs/${job.id}`,
							className: "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-ink hover:bg-surface-subtle",
							children: ["Open assignment workspace", /* @__PURE__ */ jsx(ChevronRight, {
								className: "h-4 w-4",
								"aria-hidden": "true"
							})]
						})
					]
				})]
			}),
			conflicts.length > 0 && /* @__PURE__ */ jsxs("div", {
				className: "rounded-lg border border-danger/30 bg-danger-soft p-4",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-center gap-2 text-sm font-semibold text-danger",
					children: [
						/* @__PURE__ */ jsx(AlertTriangle, {
							className: "h-4 w-4 shrink-0",
							"aria-hidden": "true"
						}),
						conflicts.length,
						" active operational conflict",
						conflicts.length === 1 ? "" : "s",
						" on this job"
					]
				}), /* @__PURE__ */ jsx("ul", {
					className: "mt-2 space-y-1 text-xs text-danger",
					children: conflicts.map((c) => /* @__PURE__ */ jsxs("li", { children: ["• ", c.description] }, c.id))
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]",
				children: [/* @__PURE__ */ jsxs(Panel, {
					className: "p-4",
					children: [
						/* @__PURE__ */ jsx("h3", {
							className: "font-semibold",
							children: "Dispatch context"
						}),
						/* @__PURE__ */ jsxs("dl", {
							className: "mt-3 divide-y divide-line",
							children: [
								/* @__PURE__ */ jsx(DataPair, {
									label: "Schedule",
									value: `${formatDateTime$1(job.scheduled_start)} – ${formatDateTime$1(job.scheduled_end)}`
								}),
								/* @__PURE__ */ jsx(DataPair, {
									label: "Site",
									value: /* @__PURE__ */ jsxs("span", {
										className: "inline-flex items-start gap-2",
										children: [/* @__PURE__ */ jsx(MapPin, {
											className: "mt-0.5 h-4 w-4 shrink-0 text-ink-soft",
											"aria-hidden": "true"
										}), job.site]
									})
								}),
								/* @__PURE__ */ jsx(DataPair, {
									label: "Last updated",
									value: formatDateTime$1(job.updated_at)
								})
							]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-4 rounded-lg bg-surface-subtle p-3",
							children: [/* @__PURE__ */ jsx("p", {
								className: "text-xs font-semibold",
								children: "Site note"
							}), /* @__PURE__ */ jsx("p", {
								className: "mt-1 text-sm leading-6 text-ink-soft",
								children: job.site_notes?.trim() || "No additional site instructions were recorded."
							})]
						})
					]
				}), /* @__PURE__ */ jsxs(Panel, {
					className: "overflow-hidden",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "border-b border-line px-4 py-3",
						children: [/* @__PURE__ */ jsx("h3", {
							className: "font-semibold",
							children: "Assigned resources"
						}), /* @__PURE__ */ jsx("p", {
							className: "mt-0.5 text-xs text-ink-soft",
							children: "Current server-backed personnel and assets"
						})]
					}), assignments.length === 0 ? /* @__PURE__ */ jsx(EmptyState, {
						compact: true,
						icon: UserRound,
						title: "No resources assigned",
						message: "Assignments will appear after the authorized scheduling workflow completes."
					}) : /* @__PURE__ */ jsx("ul", {
						className: "divide-y divide-line",
						children: assignments.map((assignment) => {
							const Icon = assignment.icon;
							return /* @__PURE__ */ jsxs("li", {
								className: "flex items-start gap-3 px-4 py-3",
								children: [/* @__PURE__ */ jsx("div", {
									className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-ink-soft",
									children: /* @__PURE__ */ jsx(Icon, {
										className: "h-4 w-4",
										"aria-hidden": "true"
									})
								}), /* @__PURE__ */ jsxs("div", {
									className: "min-w-0",
									children: [/* @__PURE__ */ jsx("p", {
										className: "truncate text-sm font-medium",
										children: assignment.primary
									}), /* @__PURE__ */ jsx("p", {
										className: "mt-0.5 text-xs text-ink-soft",
										children: assignment.secondary
									})]
								})]
							}, assignment.id);
						})
					})]
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm",
				children: [/* @__PURE__ */ jsx(CalendarDays, {
					className: "mt-0.5 h-4 w-4 shrink-0 text-brand-strong",
					"aria-hidden": "true"
				}), /* @__PURE__ */ jsx("p", {
					className: "leading-6 text-ink-soft",
					children: "Open the assignment workspace to review server-authoritative availability, credentials, maintenance blocks, readiness, and schedule conflicts before confirming resources."
				})]
			})
		]
	});
}
function DispatchInput({ label, value, onChange, error, type = "text" }) {
	const errorId = `dispatch-${label.toLowerCase().replaceAll(" ", "-")}-error`;
	return /* @__PURE__ */ jsxs("label", {
		className: "text-sm font-medium text-ink",
		children: [
			label,
			/* @__PURE__ */ jsx("input", {
				type,
				value,
				onChange: (event) => onChange(event.target.value),
				"aria-invalid": error ? "true" : void 0,
				"aria-describedby": error ? errorId : void 0,
				className: cn("mt-1 h-11 w-full rounded-lg border bg-surface px-3", error ? "border-danger" : "border-line-strong")
			}),
			error && /* @__PURE__ */ jsx("span", {
				id: errorId,
				className: "mt-1 block text-xs text-danger",
				children: error
			})
		]
	});
}
function DispatchListSkeleton() {
	return /* @__PURE__ */ jsx("div", {
		className: "space-y-px",
		"aria-label": "Loading dispatch jobs",
		children: [
			1,
			2,
			3
		].map((item) => /* @__PURE__ */ jsxs("div", {
			className: "animate-pulse border-b border-line px-4 py-4",
			children: [
				/* @__PURE__ */ jsx("div", { className: "h-3 w-24 rounded bg-line" }),
				/* @__PURE__ */ jsx("div", { className: "mt-3 h-3 w-40 rounded bg-line" }),
				/* @__PURE__ */ jsx("div", { className: "mt-3 h-2.5 w-32 rounded bg-surface-subtle" })
			]
		}, item))
	});
}
function calculateTimeSpan(startIso, endIso) {
	if (!startIso || !endIso) return {
		startCol: 1,
		colSpan: 3
	};
	const start = new Date(startIso);
	const end = new Date(endIso);
	const startHour = start.getHours() + start.getMinutes() / 60;
	const endHour = end.getHours() + end.getMinutes() / 60;
	let startCol = Math.max(1, Math.floor(startHour - 7) + 1);
	let endCol = Math.min(12, Math.ceil(endHour - 7) + 1);
	if (startCol >= 12) startCol = 11;
	if (endCol <= startCol) endCol = startCol + 1;
	const colSpan = Math.max(1, endCol - startCol);
	return {
		startCol,
		colSpan
	};
}
function isOverlapping(s1, e1, s2, e2) {
	if (!s1 || !e1 || !s2 || !e2) return false;
	const start1 = new Date(s1).getTime();
	const end1 = new Date(e1).getTime();
	const start2 = new Date(s2).getTime();
	return start1 < new Date(e2).getTime() && start2 < end1;
}
function formatDateTime$1(value) {
	if (value === null) return "Not scheduled";
	return new Intl.DateTimeFormat(void 0, {
		dateStyle: "medium",
		timeStyle: "short"
	}).format(new Date(value));
}
function humanize$1(value) {
	return value.replaceAll("_", " ");
}
//#endregion
//#region resources/js/components/openstreetmap-tracking-map.tsx
var DEFAULT_CENTER = [14.64, 121.04];
var DEFAULT_ZOOM = 11;
function OpenStreetMapTrackingMap({ locations }) {
	const mappedLocations = useMemo(() => locations.filter((location) => location.latitude !== null && location.longitude !== null), [locations]);
	const mapCenter = useMemo(() => averagePosition(mappedLocations), [mappedLocations]);
	const [selectedId, setSelectedId] = useState(null);
	const selected = mappedLocations.find((location) => location.id === selectedId) ?? mappedLocations[0];
	return /* @__PURE__ */ jsxs("div", {
		className: "grid min-h-[30rem] grid-cols-1 overflow-hidden rounded-xl border border-line xl:grid-cols-[minmax(0,1fr)_20rem]",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "relative min-h-[30rem] bg-[#eef3f6]",
			children: [
				/* @__PURE__ */ jsxs(MapContainer, {
					center: mapCenter,
					zoom: DEFAULT_ZOOM,
					scrollWheelZoom: true,
					className: "h-full min-h-[30rem] w-full",
					"aria-label": "OpenStreetMap showing live field locations",
					children: [
						/* @__PURE__ */ jsx(TileLayer, {
							url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
							attribution: "© <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors"
						}),
						/* @__PURE__ */ jsx(TrackingMapViewport, { selected }),
						/* @__PURE__ */ jsx("div", {
							className: "absolute top-3 left-3 z-[500]",
							children: /* @__PURE__ */ jsx(MapCenterButton, { center: mapCenter })
						}),
						mappedLocations.map((location) => {
							const position = locationPosition(location);
							const isSelected = location.id === selected?.id;
							return /* @__PURE__ */ jsx(CircleMarker, {
								center: position,
								radius: isSelected ? 11 : 8,
								eventHandlers: { click: () => setSelectedId(location.id) },
								pathOptions: {
									color: "var(--color-surface)",
									fillColor: freshnessColor(location.freshness_status),
									fillOpacity: location.freshness_status === "offline" ? .55 : .95,
									weight: isSelected ? 4 : 2
								},
								children: /* @__PURE__ */ jsxs(Popup, { children: [
									/* @__PURE__ */ jsx("strong", { children: location.user.name }),
									/* @__PURE__ */ jsx("br", {}),
									location.asset?.name ?? "Field worker",
									/* @__PURE__ */ jsx("br", {}),
									location.freshness_status
								] })
							}, location.id);
						})
					]
				}),
				/* @__PURE__ */ jsx("div", {
					className: "pointer-events-none absolute right-3 bottom-3 z-[500] rounded-lg bg-surface/95 p-3 text-xs text-ink-soft shadow-sm",
					children: "OpenStreetMap basemap · Live coordinates"
				}),
				mappedLocations.length === 0 && /* @__PURE__ */ jsx("div", {
					className: "pointer-events-none absolute inset-0 z-[500] flex items-center justify-center p-6",
					children: /* @__PURE__ */ jsx("div", {
						className: "rounded-lg border border-line bg-surface/95 px-4 py-3 text-sm text-ink-soft shadow-sm",
						children: "Coordinates are unavailable for the selected updates."
					})
				})
			]
		}), /* @__PURE__ */ jsxs("aside", {
			className: "max-h-[30rem] overflow-y-auto border-t border-line bg-surface xl:border-t-0 xl:border-l",
			"aria-label": "Mapped location list",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "sticky top-0 z-10 border-b border-line bg-surface px-4 py-3",
				children: [/* @__PURE__ */ jsx("h3", {
					className: "font-semibold text-ink",
					children: "Mapped locations"
				}), /* @__PURE__ */ jsxs("p", {
					className: "mt-0.5 text-xs text-ink-soft",
					children: [
						mappedLocations.length,
						" of ",
						locations.length,
						" updates mapped"
					]
				})]
			}), /* @__PURE__ */ jsx("ul", {
				className: "divide-y divide-line",
				children: locations.map((location) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs("button", {
					type: "button",
					onClick: () => location.latitude !== null && location.longitude !== null && setSelectedId(location.id),
					disabled: location.latitude === null || location.longitude === null,
					className: cn("w-full px-4 py-3 text-left hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60", location.id === selected?.id && "bg-brand-soft"),
					children: [/* @__PURE__ */ jsxs("div", {
						className: "flex items-start justify-between gap-3",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "flex items-start gap-2",
							children: [/* @__PURE__ */ jsx(MapPin, {
								className: "mt-0.5 h-4 w-4 shrink-0 text-ink-soft",
								"aria-hidden": "true"
							}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
								className: "text-sm font-semibold text-ink",
								children: location.user.name
							}), /* @__PURE__ */ jsx("p", {
								className: "mt-1 text-xs text-ink-soft",
								children: location.asset?.code ?? "Field worker"
							})] })]
						}), /* @__PURE__ */ jsx(StatusBadge, { status: location.freshness_status })]
					}), /* @__PURE__ */ jsx("p", {
						className: "mt-2 text-xs text-ink-soft",
						children: location.latitude !== null && location.longitude !== null ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : "Coordinates pruned / unavailable"
					})]
				}) }, location.id))
			})]
		})]
	});
}
function MapCenterButton({ center }) {
	const map = useMap();
	return /* @__PURE__ */ jsx(Button, {
		size: "icon",
		variant: "secondary",
		onClick: () => map.flyTo(center, DEFAULT_ZOOM),
		"aria-label": "Center the live locations map",
		title: "Center map",
		children: /* @__PURE__ */ jsx(LocateFixed, {
			className: "h-4 w-4",
			"aria-hidden": "true"
		})
	});
}
function TrackingMapViewport({ selected }) {
	const map = useMap();
	useEffect(() => {
		if (!selected) return;
		map.flyTo(locationPosition(selected), 13, { duration: .35 });
	}, [map, selected]);
	return null;
}
function locationPosition(location) {
	return [location.latitude ?? DEFAULT_CENTER[0], location.longitude ?? DEFAULT_CENTER[1]];
}
function averagePosition(locations) {
	if (locations.length === 0) return DEFAULT_CENTER;
	return [locations.reduce((sum, location) => sum + (location.latitude ?? 0), 0) / locations.length, locations.reduce((sum, location) => sum + (location.longitude ?? 0), 0) / locations.length];
}
function freshnessColor(freshness) {
	switch (freshness) {
		case "fresh": return "var(--color-success-strong)";
		case "delayed": return "var(--color-warning-strong)";
		case "stale": return "var(--color-danger)";
		case "offline": return "var(--color-muted)";
	}
}
//#endregion
//#region resources/js/lib/outbox.ts
var STORAGE_KEY = "field_ops_outbox_queue_v1";
var activeSyncPromise = null;
function getOutboxQueue() {
	if (typeof window === "undefined") return [];
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return stored ? JSON.parse(stored) : [];
	} catch {
		return [];
	}
}
function saveOutboxQueue(queue) {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
	} catch {}
}
function queueCommand(action, url, payload, expectedVersion) {
	const commandId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
	const item = {
		id: commandId,
		commandId,
		action,
		url,
		payload: {
			...payload,
			command_id: commandId
		},
		expectedVersion,
		status: "queued",
		createdAt: (/* @__PURE__ */ new Date()).toISOString()
	};
	const queue = getOutboxQueue();
	queue.push(item);
	saveOutboxQueue(queue);
	return item;
}
function syncOutbox() {
	if (activeSyncPromise !== null) return activeSyncPromise;
	activeSyncPromise = syncOutboxQueue().finally(() => {
		activeSyncPromise = null;
	});
	return activeSyncPromise;
}
async function syncOutboxQueue() {
	const queue = getOutboxQueue();
	for (const item of queue) {
		if (![
			"queued",
			"failed",
			"syncing"
		].includes(item.status)) continue;
		updateOutboxItemStatus(item.id, "syncing");
		try {
			const csrf = document.querySelector("meta[name=\"csrf-token\"]")?.getAttribute("content");
			const response = await fetch(item.url, {
				method: "POST",
				credentials: "same-origin",
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json",
					...csrf ? { "X-CSRF-TOKEN": csrf } : {},
					"Idempotency-Key": item.commandId
				},
				body: JSON.stringify(item.payload)
			});
			if (response.status === 409) updateOutboxItemStatus(item.id, "conflict", "The server rejected this command because the record changed.", { status: response.status });
			else if (!response.ok) updateOutboxItemStatus(item.id, "failed", `Server returned HTTP ${response.status}.`);
			else updateOutboxItemStatus(item.id, "synchronized");
		} catch {
			updateOutboxItemStatus(item.id, "failed", "Network unavailable; retry when connectivity returns.");
		}
	}
}
function updateOutboxItemStatus(id, status, errorMessage, conflictData) {
	saveOutboxQueue(getOutboxQueue().map((item) => {
		if (item.id === id) return {
			...item,
			status,
			errorMessage: errorMessage ?? item.errorMessage,
			conflictData: conflictData ?? item.conflictData
		};
		return item;
	}));
}
function removeOutboxItem(id) {
	saveOutboxQueue(getOutboxQueue().filter((item) => item.id !== id));
}
//#endregion
//#region resources/js/components/surfaces/tracking-surfaces.tsx
function TrackingSurface({ locations, capabilities }) {
	const [viewMode, setViewMode] = useState("visual");
	const [statusFilter, setStatusFilter] = useState("all");
	const [lastPolledAt, setLastPolledAt] = useState(/* @__PURE__ */ new Date());
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [pollError, setPollError] = useState(false);
	const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
	const [outboxQueue, setOutboxQueue] = useState(() => getOutboxQueue());
	const [sharingPending, setSharingPending] = useState(false);
	const sharingEnabled = locations[0]?.sharing_enabled ?? false;
	const refreshData = useCallback(() => {
		setIsRefreshing(true);
		router.reload({
			only: ["locations", "workspace"],
			onSuccess: () => setPollError(false),
			onError: () => setPollError(true),
			onFinish: () => {
				setIsRefreshing(false);
				setLastPolledAt(/* @__PURE__ */ new Date());
				setOutboxQueue(getOutboxQueue());
			}
		});
	}, []);
	useEffect(() => {
		const interval = window.setInterval(() => {
			refreshData();
		}, 15e3);
		return () => window.clearInterval(interval);
	}, [refreshData]);
	useEffect(() => {
		const markOnline = () => setIsOnline(true);
		const markOffline = () => setIsOnline(false);
		window.addEventListener("online", markOnline);
		window.addEventListener("offline", markOffline);
		return () => {
			window.removeEventListener("online", markOnline);
			window.removeEventListener("offline", markOffline);
		};
	}, []);
	const toggleSharing = async (enable) => {
		setSharingPending(true);
		const submit = async (payload) => {
			queueCommand("location.store", "/operations/locations", payload);
			setOutboxQueue(getOutboxQueue());
			await syncOutbox();
			setOutboxQueue(getOutboxQueue());
			setSharingPending(false);
			refreshData();
		};
		if (!enable) {
			await submit({
				sharing_enabled: false,
				captured_at: (/* @__PURE__ */ new Date()).toISOString()
			});
			return;
		}
		if (!("geolocation" in navigator)) {
			setSharingPending(false);
			return;
		}
		navigator.geolocation.getCurrentPosition((pos) => void submit({
			latitude: pos.coords.latitude,
			longitude: pos.coords.longitude,
			accuracy_metres: pos.coords.accuracy,
			captured_at: new Date(pos.timestamp).toISOString(),
			sharing_enabled: true
		}), () => setSharingPending(false), {
			enableHighAccuracy: true,
			timeout: 1e4
		});
	};
	useEffect(() => {
		const flush = () => void syncOutbox().then(() => setOutboxQueue(getOutboxQueue()));
		window.addEventListener("online", flush);
		flush();
		return () => window.removeEventListener("online", flush);
	}, []);
	const filteredLocations = locations.filter((loc) => {
		if (statusFilter === "all") return true;
		return loc.freshness_status === statusFilter;
	});
	return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(PageHeading, {
		title: "Live Field Tracking & Resilience",
		description: "Monitor worker and asset locations, verify freshness, retention limits, and manage offline outbox state."
	}), /* @__PURE__ */ jsxs("div", {
		className: "space-y-6 p-4 md:p-6",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4 shadow-sm",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ jsx("div", {
						className: "flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand-strong",
						children: /* @__PURE__ */ jsx(Activity, {
							className: "h-5 w-5",
							"aria-hidden": "true"
						})
					}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ jsx("span", {
							className: "font-semibold text-ink",
							children: "Measured Polling (15s)"
						}), /* @__PURE__ */ jsxs("span", {
							className: cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", !isOnline || pollError ? "bg-danger-soft text-danger" : "bg-success-soft text-success-strong"),
							role: "status",
							children: [/* @__PURE__ */ jsx("span", { className: cn("h-1.5 w-1.5 rounded-full", !isOnline || pollError ? "bg-danger" : "animate-pulse bg-success-strong") }), !isOnline ? "Offline" : pollError ? "Sync issue" : "Live"]
						})]
					}), /* @__PURE__ */ jsxs("p", {
						className: "text-xs text-ink-soft",
						children: [
							"Last poll attempt:",
							" ",
							lastPolledAt.toLocaleTimeString(),
							" · Retention: 30-day precise coordinates"
						]
					})] })]
				}), /* @__PURE__ */ jsxs("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [
						capabilities.share_location && /* @__PURE__ */ jsx(Button, {
							variant: "secondary",
							size: "sm",
							disabled: sharingPending,
							onClick: () => toggleSharing(!sharingEnabled),
							children: sharingEnabled ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(PauseCircle, { className: "mr-1.5 h-4 w-4 text-warning-strong" }), "Pause Location Sharing"] }) : /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(Navigation, { className: "mr-1.5 h-4 w-4 text-brand-strong" }), "Enable Location Sharing"] })
						}),
						/* @__PURE__ */ jsxs(Button, {
							variant: "secondary",
							size: "sm",
							onClick: refreshData,
							disabled: isRefreshing,
							children: [/* @__PURE__ */ jsx(RefreshCw, { className: cn("mr-1.5 h-4 w-4", isRefreshing && "animate-spin") }), isRefreshing ? "Polling…" : "Refresh now"]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "inline-flex rounded-lg border border-line bg-surface-subtle p-1",
							children: [/* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: () => setViewMode("visual"),
								className: cn("rounded px-3 py-1 text-xs font-medium transition-colors", viewMode === "visual" ? "bg-surface font-semibold text-ink shadow-sm" : "text-ink-soft hover:text-ink"),
								"aria-label": "Switch to map view",
								"aria-pressed": viewMode === "visual",
								children: "Map View"
							}), /* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: () => setViewMode("list"),
								className: cn("rounded px-3 py-1 text-xs font-medium transition-colors", viewMode === "list" ? "bg-surface font-semibold text-ink shadow-sm" : "text-ink-soft hover:text-ink"),
								"aria-label": "Switch to accessible synchronized list view",
								"aria-pressed": viewMode === "list",
								children: "Synchronized List"
							})]
						})
					]
				})]
			}),
			outboxQueue.length > 0 && /* @__PURE__ */ jsx(OutboxQueuePanel, {
				queue: outboxQueue,
				onResolved: () => setOutboxQueue(getOutboxQueue())
			}),
			/* @__PURE__ */ jsx("div", {
				className: "flex border-b border-line",
				children: [
					"all",
					"fresh",
					"delayed",
					"stale",
					"offline"
				].map((status) => {
					const count = locations.filter((l) => {
						if (status === "all") return true;
						return l.freshness_status === status;
					}).length;
					return /* @__PURE__ */ jsxs("button", {
						type: "button",
						onClick: () => setStatusFilter(status),
						className: cn("border-b-2 px-4 py-2.5 text-sm font-medium capitalize transition-colors", statusFilter === status ? "border-brand-strong font-semibold text-brand-strong" : "border-transparent text-ink-soft hover:text-ink"),
						"aria-pressed": statusFilter === status,
						children: [
							status,
							" (",
							count,
							")"
						]
					}, status);
				})
			}),
			filteredLocations.length === 0 ? /* @__PURE__ */ jsx(Panel, { children: /* @__PURE__ */ jsx(EmptyState, {
				icon: Compass,
				title: "No location updates found",
				message: "No field worker or asset updates match the selected freshness filter."
			}) }) : viewMode === "visual" ? /* @__PURE__ */ jsx(OpenStreetMapTrackingMap, { locations: filteredLocations }) : /* @__PURE__ */ jsx(SynchronizedLocationList, { locations: filteredLocations })
		]
	})] });
}
function SynchronizedLocationList({ locations }) {
	return /* @__PURE__ */ jsx(Panel, {
		className: "overflow-hidden",
		children: /* @__PURE__ */ jsxs("table", {
			className: "w-full text-left text-sm",
			"aria-label": "Synchronized field location updates",
			children: [
				/* @__PURE__ */ jsx("caption", {
					className: "sr-only",
					children: "List of current location updates showing worker name, coordinates, accuracy, capture time, receive time, sharing state, and freshness."
				}),
				/* @__PURE__ */ jsx("thead", {
					className: "border-b border-line bg-surface-subtle text-xs font-semibold text-ink-soft uppercase",
					children: /* @__PURE__ */ jsxs("tr", { children: [
						/* @__PURE__ */ jsx("th", {
							scope: "col",
							className: "px-4 py-3",
							children: "Worker / Asset"
						}),
						/* @__PURE__ */ jsx("th", {
							scope: "col",
							className: "px-4 py-3",
							children: "Freshness Status"
						}),
						/* @__PURE__ */ jsx("th", {
							scope: "col",
							className: "px-4 py-3",
							children: "Coordinates"
						}),
						/* @__PURE__ */ jsx("th", {
							scope: "col",
							className: "px-4 py-3",
							children: "Accuracy"
						}),
						/* @__PURE__ */ jsx("th", {
							scope: "col",
							className: "px-4 py-3",
							children: "Sharing"
						}),
						/* @__PURE__ */ jsx("th", {
							scope: "col",
							className: "px-4 py-3",
							children: "Captured Time"
						}),
						/* @__PURE__ */ jsx("th", {
							scope: "col",
							className: "px-4 py-3",
							children: "Received Time"
						})
					] })
				}),
				/* @__PURE__ */ jsx("tbody", {
					className: "divide-y divide-line",
					children: locations.map((loc) => /* @__PURE__ */ jsxs("tr", {
						className: "transition-colors hover:bg-surface-subtle",
						children: [
							/* @__PURE__ */ jsxs("td", {
								className: "px-4 py-3 font-semibold text-ink",
								children: [loc.user.name, loc.asset && /* @__PURE__ */ jsx("div", {
									className: "text-xs font-normal text-ink-soft",
									children: loc.asset.code
								})]
							}),
							/* @__PURE__ */ jsx("td", {
								className: "px-4 py-3",
								children: /* @__PURE__ */ jsx(FreshnessBadge, { status: loc.freshness_status })
							}),
							/* @__PURE__ */ jsx("td", {
								className: "px-4 py-3 font-mono text-xs",
								children: loc.latitude !== null && loc.longitude !== null ? `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}` : "Pruned / Off"
							}),
							/* @__PURE__ */ jsx("td", {
								className: "px-4 py-3 text-xs",
								children: loc.accuracy_metres ? `±${loc.accuracy_metres}m` : "N/A"
							}),
							/* @__PURE__ */ jsx("td", {
								className: "px-4 py-3 text-xs font-medium",
								children: loc.sharing_enabled ? /* @__PURE__ */ jsx("span", {
									className: "text-success-strong",
									children: "On"
								}) : /* @__PURE__ */ jsx("span", {
									className: "text-warning-strong",
									children: "Off"
								})
							}),
							/* @__PURE__ */ jsx("td", {
								className: "px-4 py-3 text-xs text-ink-soft",
								children: loc.captured_at ? new Date(loc.captured_at).toLocaleTimeString() : "N/A"
							}),
							/* @__PURE__ */ jsx("td", {
								className: "px-4 py-3 text-xs text-ink-soft",
								children: loc.received_at ? new Date(loc.received_at).toLocaleTimeString() : "N/A"
							})
						]
					}, loc.id))
				})
			]
		})
	});
}
function FreshnessBadge({ status }) {
	const config = status === "fresh" ? {
		label: "Fresh (≤2m)",
		cls: "bg-success-soft text-success-strong"
	} : status === "delayed" ? {
		label: "Delayed (2–10m)",
		cls: "bg-info-soft text-info-strong"
	} : status === "stale" ? {
		label: "Stale (10–30m)",
		cls: "bg-warning-soft text-warning-strong"
	} : {
		label: "Offline / Off",
		cls: "bg-danger-soft text-danger"
	};
	return /* @__PURE__ */ jsx("span", {
		className: cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", config.cls),
		children: config.label
	});
}
function OutboxQueuePanel({ queue, onResolved }) {
	const resolveConflict = (id) => {
		removeOutboxItem(id);
		onResolved();
	};
	return /* @__PURE__ */ jsxs(Panel, {
		className: "border-warning-strong bg-warning-soft/20 p-4",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "flex items-center justify-between border-b border-warning-strong/30 pb-3",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ jsx(AlertTriangle, { className: "h-5 w-5 text-warning-strong" }), /* @__PURE__ */ jsxs("h3", {
					className: "font-semibold text-ink",
					children: [
						"Durable Outbox Queue (",
						queue.length,
						" items)"
					]
				})]
			}), /* @__PURE__ */ jsx("span", {
				className: "text-xs font-medium text-ink-soft",
				children: "Version-Aware Replay & Retry Active"
			})]
		}), /* @__PURE__ */ jsx("ul", {
			className: "mt-3 divide-y divide-line",
			children: queue.map((item) => /* @__PURE__ */ jsxs("li", {
				className: "flex flex-wrap items-center justify-between gap-3 py-2 text-xs",
				children: [/* @__PURE__ */ jsxs("div", { children: [
					/* @__PURE__ */ jsx("span", {
						className: "font-semibold text-ink capitalize",
						children: item.action
					}),
					" ",
					"·",
					" ",
					/* @__PURE__ */ jsx("span", {
						className: "font-mono",
						children: item.commandId
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "text-ink-soft",
						children: [
							"Status:",
							" ",
							/* @__PURE__ */ jsx("span", {
								className: "font-semibold capitalize",
								children: item.status
							}),
							" ",
							"· Created:",
							" ",
							new Date(item.createdAt).toLocaleTimeString()
						]
					})
				] }), item.status === "conflict" ? /* @__PURE__ */ jsxs("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ jsx("span", {
						className: "font-medium text-danger",
						children: "409 Version Conflict"
					}), /* @__PURE__ */ jsx(Button, {
						size: "sm",
						variant: "secondary",
						onClick: () => resolveConflict(item.id),
						children: "Acknowledge Server Version"
					})]
				}) : /* @__PURE__ */ jsx(Button, {
					size: "sm",
					variant: "secondary",
					onClick: () => resolveConflict(item.id),
					children: "Clear from outbox"
				})]
			}, item.id))
		})]
	});
}
//#endregion
//#region resources/js/components/workspace/live-workspace-sections.tsx
function LiveWorkspaceSection({ section, assets, fuelRequests, locations, approvals, users, auditEvents, capabilities }) {
	switch (section) {
		case "assets": return /* @__PURE__ */ jsx(AssetsSurface, {
			assets,
			capabilities
		});
		case "fuel": return /* @__PURE__ */ jsx(FuelSurface, {
			requests: fuelRequests,
			capabilities
		});
		case "tracking": return /* @__PURE__ */ jsx(TrackingSurface, {
			locations,
			capabilities
		});
		case "approvals": return /* @__PURE__ */ jsx(ApprovalsSurface, {
			approvals,
			canDecide: capabilities.decide_approval
		});
		case "users": return /* @__PURE__ */ jsx(UsersSurface, { users });
		case "audit": return /* @__PURE__ */ jsx(AuditSurface, { events: auditEvents });
	}
}
function AssetsSurface({ assets, capabilities }) {
	const [selectedAssetId, setSelectedAssetId] = useState(assets.length > 0 ? assets[0].id : null);
	const [showRegisterForm, setShowRegisterForm] = useState(false);
	const selectedAsset = assets.find((a) => a.id === selectedAssetId) ?? assets[0];
	return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(PageHeading, {
		title: "Fleet and equipment",
		description: "Manage asset registration, readiness status, specifications, safety inspections, and maintenance work orders."
	}), /* @__PURE__ */ jsxs("div", {
		className: "space-y-6 p-4 md:p-6",
		children: [
			capabilities.register_asset && /* @__PURE__ */ jsx("div", {
				className: "flex justify-end",
				children: /* @__PURE__ */ jsx(Button, {
					variant: showRegisterForm ? "secondary" : "primary",
					onClick: () => setShowRegisterForm(!showRegisterForm),
					children: showRegisterForm ? "Cancel registration" : "Register new asset"
				})
			}),
			showRegisterForm && capabilities.register_asset && /* @__PURE__ */ jsx(RegisterAssetForm, { onDone: () => setShowRegisterForm(false) }),
			assets.length === 0 ? /* @__PURE__ */ jsx(Panel, { children: /* @__PURE__ */ jsx(EmptyState, {
				icon: Truck,
				title: "No assets available",
				message: "Assigned or organization-wide fleet and equipment will appear here once registered or assigned to your role."
			}) }) : /* @__PURE__ */ jsxs("div", {
				className: "grid gap-6 lg:grid-cols-12",
				children: [/* @__PURE__ */ jsx("div", {
					className: "lg:col-span-5 xl:col-span-4",
					children: /* @__PURE__ */ jsxs(Panel, {
						className: "overflow-hidden",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "border-b border-line px-4 py-3 font-semibold text-ink",
							children: [
								"Operational assets (",
								assets.length,
								")"
							]
						}), /* @__PURE__ */ jsx("ul", {
							className: "divide-y divide-line",
							children: assets.map((asset) => {
								const isSelected = asset.id === selectedAsset?.id;
								return /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs("button", {
									type: "button",
									onClick: () => setSelectedAssetId(asset.id),
									className: cn("w-full px-4 py-3 text-left transition-colors hover:bg-surface-subtle", isSelected && "bg-brand-soft/60"),
									"aria-pressed": isSelected,
									children: [
										/* @__PURE__ */ jsxs("div", {
											className: "flex items-center justify-between gap-2",
											children: [/* @__PURE__ */ jsx("span", {
												className: "font-semibold text-ink",
												children: asset.code
											}), /* @__PURE__ */ jsx(CanonicalStatusBadge, { status: asset.status })]
										}),
										/* @__PURE__ */ jsx("p", {
											className: "mt-1 text-sm font-medium text-ink-soft",
											children: asset.name
										}),
										/* @__PURE__ */ jsxs("div", {
											className: "mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft",
											children: [
												/* @__PURE__ */ jsx("span", { children: humanize(asset.kind) }),
												/* @__PURE__ */ jsx("span", { children: "·" }),
												/* @__PURE__ */ jsx("span", { children: asset.location ?? "Location not set" }),
												asset.blocking_work_orders_count > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("span", { children: "·" }), /* @__PURE__ */ jsxs("span", {
													className: "font-medium text-danger",
													children: [
														asset.blocking_work_orders_count,
														" ",
														"blocking"
													]
												})] })
											]
										})
									]
								}) }, asset.id);
							})
						})]
					})
				}), /* @__PURE__ */ jsx("div", {
					className: "lg:col-span-7 xl:col-span-8",
					children: selectedAsset && /* @__PURE__ */ jsx(AssetDetailPane, {
						asset: selectedAsset,
						capabilities
					})
				})]
			})
		]
	})] });
}
function RegisterAssetForm({ onDone }) {
	const form = useForm({
		code: "",
		name: "",
		kind: "truck",
		subtype: "",
		registration_number: "",
		manufacturer: "",
		model: "",
		rated_capacity: "",
		capacity_unit: "tonnes",
		meter_type: "odometer",
		meter_value: "",
		location: ""
	});
	const submit = (e) => {
		e.preventDefault();
		form.post("/operations/assets", {
			preserveScroll: true,
			onSuccess: () => {
				form.reset();
				onDone();
			}
		});
	};
	return /* @__PURE__ */ jsxs(Panel, {
		className: "p-4 md:p-6",
		children: [
			/* @__PURE__ */ jsx("h3", {
				className: "text-base font-semibold text-ink",
				children: "Register Operational Asset"
			}),
			/* @__PURE__ */ jsx("p", {
				className: "mt-1 text-sm text-ink-soft",
				children: "Add a new truck, vehicle, crane, or piece of heavy equipment to the unified asset model."
			}),
			/* @__PURE__ */ jsxs("form", {
				onSubmit: submit,
				className: "mt-4 space-y-4",
				noValidate: true,
				children: [/* @__PURE__ */ jsxs("div", {
					className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
					children: [
						/* @__PURE__ */ jsx(FuelInput, {
							label: "Asset code *",
							value: form.data.code,
							error: form.errors.code,
							onChange: (v) => form.setData("code", v)
						}),
						/* @__PURE__ */ jsx(FuelInput, {
							label: "Asset name *",
							value: form.data.name,
							error: form.errors.name,
							onChange: (v) => form.setData("name", v)
						}),
						/* @__PURE__ */ jsxs("label", {
							className: "text-sm font-medium text-ink",
							children: ["Asset kind *", /* @__PURE__ */ jsxs("select", {
								value: form.data.kind,
								onChange: (e) => form.setData("kind", e.target.value),
								className: "mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3",
								children: [
									/* @__PURE__ */ jsx("option", {
										value: "truck",
										children: "Truck"
									}),
									/* @__PURE__ */ jsx("option", {
										value: "vehicle",
										children: "Vehicle"
									}),
									/* @__PURE__ */ jsx("option", {
										value: "crane",
										children: "Crane"
									}),
									/* @__PURE__ */ jsx("option", {
										value: "equipment",
										children: "Equipment"
									})
								]
							})]
						}),
						/* @__PURE__ */ jsx(FuelInput, {
							label: "Subtype (e.g. Flatbed, All-Terrain)",
							value: form.data.subtype,
							error: form.errors.subtype,
							onChange: (v) => form.setData("subtype", v)
						}),
						/* @__PURE__ */ jsx(FuelInput, {
							label: "Registration number",
							value: form.data.registration_number,
							error: form.errors.registration_number,
							onChange: (v) => form.setData("registration_number", v)
						}),
						/* @__PURE__ */ jsx(FuelInput, {
							label: "Manufacturer",
							value: form.data.manufacturer,
							error: form.errors.manufacturer,
							onChange: (v) => form.setData("manufacturer", v)
						}),
						/* @__PURE__ */ jsx(FuelInput, {
							label: "Model",
							value: form.data.model,
							error: form.errors.model,
							onChange: (v) => form.setData("model", v)
						}),
						/* @__PURE__ */ jsx(FuelInput, {
							label: "Rated capacity",
							type: "number",
							value: form.data.rated_capacity,
							error: form.errors.rated_capacity,
							onChange: (v) => form.setData("rated_capacity", v)
						}),
						/* @__PURE__ */ jsx(FuelInput, {
							label: "Capacity unit",
							value: form.data.capacity_unit,
							error: form.errors.capacity_unit,
							onChange: (v) => form.setData("capacity_unit", v)
						}),
						/* @__PURE__ */ jsx(FuelInput, {
							label: "Meter type (odometer/hour_meter)",
							value: form.data.meter_type,
							error: form.errors.meter_type,
							onChange: (v) => form.setData("meter_type", v)
						}),
						/* @__PURE__ */ jsx(FuelInput, {
							label: "Meter reading",
							type: "number",
							value: form.data.meter_value,
							error: form.errors.meter_value,
							onChange: (v) => form.setData("meter_value", v)
						}),
						/* @__PURE__ */ jsx(FuelInput, {
							label: "Initial location",
							value: form.data.location,
							error: form.errors.location,
							onChange: (v) => form.setData("location", v)
						})
					]
				}), /* @__PURE__ */ jsxs("div", {
					className: "flex justify-end gap-3 border-t border-line pt-4",
					children: [/* @__PURE__ */ jsx(Button, {
						type: "button",
						variant: "secondary",
						onClick: onDone,
						children: "Cancel"
					}), /* @__PURE__ */ jsx(Button, {
						type: "submit",
						variant: "primary",
						disabled: form.processing,
						children: form.processing ? "Registering…" : "Register asset"
					})]
				})]
			})
		]
	});
}
function AssetDetailPane({ asset, capabilities }) {
	const [activeTab, setActiveTab] = useState("overview");
	return /* @__PURE__ */ jsxs(Panel, {
		className: "space-y-6 p-4 md:p-6",
		children: [
			/* @__PURE__ */ jsx("div", {
				className: "flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4",
				children: /* @__PURE__ */ jsxs("div", { children: [
					/* @__PURE__ */ jsxs("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [
							/* @__PURE__ */ jsx("span", {
								className: "text-xl font-bold text-ink",
								children: asset.code
							}),
							/* @__PURE__ */ jsx(CanonicalStatusBadge, { status: asset.status }),
							asset.is_dispatchable ? /* @__PURE__ */ jsx("span", {
								className: "inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success-strong",
								children: "Ready for dispatch"
							}) : /* @__PURE__ */ jsx("span", {
								className: "inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning-strong",
								children: "Safety hold / Non-dispatchable"
							})
						]
					}),
					/* @__PURE__ */ jsx("h2", {
						className: "mt-1 text-lg font-semibold text-ink",
						children: asset.name
					}),
					/* @__PURE__ */ jsxs("p", {
						className: "mt-0.5 text-sm text-ink-soft",
						children: [
							humanize(asset.kind),
							" ",
							asset.subtype ? `· ${asset.subtype}` : "",
							" · Location:",
							" ",
							asset.location ?? "Not reported"
						]
					})
				] })
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex border-b border-line",
				children: [
					/* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => setActiveTab("overview"),
						className: cn("border-b-2 px-4 py-2.5 text-sm font-medium transition-colors", activeTab === "overview" ? "border-brand-strong font-semibold text-brand-strong" : "border-transparent text-ink-soft hover:text-ink"),
						children: "Specifications & metrics"
					}),
					/* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => setActiveTab("status"),
						className: cn("border-b-2 px-4 py-2.5 text-sm font-medium transition-colors", activeTab === "status" ? "border-brand-strong font-semibold text-brand-strong" : "border-transparent text-ink-soft hover:text-ink"),
						children: "Status management"
					}),
					/* @__PURE__ */ jsxs("button", {
						type: "button",
						onClick: () => setActiveTab("inspections"),
						className: cn("border-b-2 px-4 py-2.5 text-sm font-medium transition-colors", activeTab === "inspections" ? "border-brand-strong font-semibold text-brand-strong" : "border-transparent text-ink-soft hover:text-ink"),
						children: [
							"Inspections (",
							asset.inspections.length,
							")"
						]
					}),
					/* @__PURE__ */ jsxs("button", {
						type: "button",
						onClick: () => setActiveTab("maintenance"),
						className: cn("border-b-2 px-4 py-2.5 text-sm font-medium transition-colors", activeTab === "maintenance" ? "border-brand-strong font-semibold text-brand-strong" : "border-transparent text-ink-soft hover:text-ink"),
						children: [
							"Work orders (",
							asset.maintenance_work_orders.length,
							")"
						]
					})
				]
			}),
			activeTab === "overview" && /* @__PURE__ */ jsxs("div", {
				className: "space-y-4",
				children: [/* @__PURE__ */ jsxs("dl", {
					className: "grid gap-4 sm:grid-cols-2 md:grid-cols-3",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "rounded-lg bg-surface-subtle p-3",
							children: [/* @__PURE__ */ jsx("dt", {
								className: "text-xs font-medium text-ink-soft",
								children: "Registration Number"
							}), /* @__PURE__ */ jsx("dd", {
								className: "mt-1 text-sm font-semibold",
								children: asset.registration_number ?? "N/A"
							})]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "rounded-lg bg-surface-subtle p-3",
							children: [/* @__PURE__ */ jsx("dt", {
								className: "text-xs font-medium text-ink-soft",
								children: "Manufacturer & Model"
							}), /* @__PURE__ */ jsxs("dd", {
								className: "mt-1 text-sm font-semibold",
								children: [
									asset.manufacturer ?? "N/A",
									" ",
									asset.model ?? ""
								]
							})]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "rounded-lg bg-surface-subtle p-3",
							children: [/* @__PURE__ */ jsx("dt", {
								className: "text-xs font-medium text-ink-soft",
								children: "Rated Capacity"
							}), /* @__PURE__ */ jsx("dd", {
								className: "mt-1 text-sm font-semibold",
								children: asset.rated_capacity ? `${asset.rated_capacity} ${asset.capacity_unit ?? ""}` : "N/A"
							})]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "rounded-lg bg-surface-subtle p-3",
							children: [/* @__PURE__ */ jsx("dt", {
								className: "text-xs font-medium text-ink-soft",
								children: "Meter Reading"
							}), /* @__PURE__ */ jsx("dd", {
								className: "mt-1 text-sm font-semibold",
								children: asset.meter_value ? `${asset.meter_value} (${asset.meter_type ?? "units"})` : "N/A"
							})]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "rounded-lg bg-surface-subtle p-3",
							children: [/* @__PURE__ */ jsx("dt", {
								className: "text-xs font-medium text-ink-soft",
								children: "Unresolved Safety Blocks"
							}), /* @__PURE__ */ jsx("dd", {
								className: "mt-1 text-sm font-semibold",
								children: asset.blocking_work_orders_count > 0 ? /* @__PURE__ */ jsxs("span", {
									className: "text-danger",
									children: [asset.blocking_work_orders_count, " open orders"]
								}) : /* @__PURE__ */ jsx("span", {
									className: "text-success-strong",
									children: "None"
								})
							})]
						})
					]
				}), Object.keys(asset.specifications ?? {}).length > 0 && /* @__PURE__ */ jsxs("div", {
					className: "mt-4",
					children: [/* @__PURE__ */ jsx("h4", {
						className: "text-xs font-semibold text-ink-soft uppercase",
						children: "Custom Specifications"
					}), /* @__PURE__ */ jsx("div", {
						className: "mt-2 grid gap-2 sm:grid-cols-2",
						children: Object.entries(asset.specifications).map(([key, val]) => /* @__PURE__ */ jsxs("div", {
							className: "flex justify-between rounded border border-line px-3 py-1.5 text-sm",
							children: [/* @__PURE__ */ jsxs("span", {
								className: "font-medium capitalize",
								children: [humanize(key), ":"]
							}), /* @__PURE__ */ jsx("span", {
								className: "text-ink-soft",
								children: String(val)
							})]
						}, key))
					})]
				})]
			}),
			activeTab === "status" && /* @__PURE__ */ jsx(AssetStatusUpdateForm, {
				asset,
				canUpdate: capabilities.update_asset_status
			}),
			activeTab === "inspections" && /* @__PURE__ */ jsx(AssetInspectionsSection, {
				asset,
				canInspect: capabilities.inspect_asset
			}),
			activeTab === "maintenance" && /* @__PURE__ */ jsx(AssetMaintenanceSection, {
				asset,
				canMaintain: capabilities.maintain_asset
			})
		]
	});
}
function AssetStatusUpdateForm({ asset, canUpdate }) {
	const form = useForm({
		status: asset.status.value,
		reason: ""
	});
	const submit = (e) => {
		e.preventDefault();
		form.post(`/operations/assets/${asset.id}/status`, {
			preserveScroll: true,
			onSuccess: () => form.reset()
		});
	};
	if (!canUpdate) return /* @__PURE__ */ jsx("div", {
		className: "rounded-lg bg-surface-subtle p-4 text-sm text-ink-soft",
		children: "Your role does not have authorization to update status for this asset kind."
	});
	return /* @__PURE__ */ jsxs("form", {
		onSubmit: submit,
		className: "space-y-4",
		noValidate: true,
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "rounded-lg border border-line bg-surface-subtle p-3 text-xs text-ink-soft",
				children: [
					/* @__PURE__ */ jsx("strong", { children: "Safety Rule:" }),
					" Transitioning to",
					" ",
					/* @__PURE__ */ jsx("span", {
						className: "font-semibold",
						children: "Ready for Service"
					}),
					" or",
					" ",
					/* @__PURE__ */ jsx("span", {
						className: "font-semibold",
						children: "Available"
					}),
					" requires a completed passing inspection and zero unreleased dispatch-blocking work orders."
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid gap-4 sm:grid-cols-2",
				children: [/* @__PURE__ */ jsxs("label", {
					className: "text-sm font-medium text-ink",
					children: ["Target status *", /* @__PURE__ */ jsxs("select", {
						value: form.data.status,
						onChange: (e) => form.setData("status", e.target.value),
						className: "mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3",
						children: [
							/* @__PURE__ */ jsx("option", {
								value: "available",
								children: "Available"
							}),
							/* @__PURE__ */ jsx("option", {
								value: "ready_for_service",
								children: "Ready for Service"
							}),
							/* @__PURE__ */ jsx("option", {
								value: "under_inspection",
								children: "Under Inspection"
							}),
							/* @__PURE__ */ jsx("option", {
								value: "under_maintenance",
								children: "Under Maintenance"
							}),
							/* @__PURE__ */ jsx("option", {
								value: "awaiting_parts",
								children: "Awaiting Parts"
							}),
							/* @__PURE__ */ jsx("option", {
								value: "unavailable",
								children: "Unavailable"
							})
						]
					})]
				}), /* @__PURE__ */ jsx(FuelInput, {
					label: "Reason for status change *",
					value: form.data.reason,
					error: form.errors.reason,
					onChange: (v) => form.setData("reason", v)
				})]
			}),
			form.errors.status && /* @__PURE__ */ jsx("p", {
				className: "text-xs font-medium text-danger",
				children: form.errors.status
			}),
			/* @__PURE__ */ jsx("div", {
				className: "flex justify-end",
				children: /* @__PURE__ */ jsx(Button, {
					type: "submit",
					variant: "primary",
					disabled: form.processing || !form.data.reason.trim(),
					children: form.processing ? "Updating…" : "Update asset status"
				})
			})
		]
	});
}
function AssetInspectionsSection({ asset, canInspect }) {
	const [showForm, setShowForm] = useState(false);
	const form = useForm({
		type: "safety",
		result: "passed",
		checklist: {
			brakes: true,
			steering: true,
			tires_or_tracks: true,
			hydraulics: true,
			lights_and_signals: true
		},
		findings: ""
	});
	const submit = (e) => {
		e.preventDefault();
		form.post(`/operations/assets/${asset.id}/inspections`, {
			preserveScroll: true,
			onSuccess: () => {
				setShowForm(false);
				form.reset();
			}
		});
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "space-y-4",
		children: [
			canInspect && /* @__PURE__ */ jsx("div", {
				className: "flex justify-end",
				children: /* @__PURE__ */ jsx(Button, {
					variant: showForm ? "secondary" : "primary",
					onClick: () => setShowForm(!showForm),
					children: showForm ? "Cancel inspection" : "Record new inspection"
				})
			}),
			showForm && canInspect && /* @__PURE__ */ jsxs("form", {
				onSubmit: submit,
				className: "space-y-4 rounded-lg border border-line bg-surface-subtle p-4",
				noValidate: true,
				children: [
					/* @__PURE__ */ jsx("h4", {
						className: "font-semibold text-ink",
						children: "Submit Safety / Pre-Op Inspection"
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "grid gap-4 sm:grid-cols-2",
						children: [/* @__PURE__ */ jsxs("label", {
							className: "text-sm font-medium text-ink",
							children: ["Inspection type", /* @__PURE__ */ jsxs("select", {
								value: form.data.type,
								onChange: (e) => form.setData("type", e.target.value),
								className: "mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3",
								children: [
									/* @__PURE__ */ jsx("option", {
										value: "pre_operation",
										children: "Pre-operation"
									}),
									/* @__PURE__ */ jsx("option", {
										value: "post_operation",
										children: "Post-operation"
									}),
									/* @__PURE__ */ jsx("option", {
										value: "maintenance",
										children: "Maintenance"
									}),
									/* @__PURE__ */ jsx("option", {
										value: "safety",
										children: "Safety"
									})
								]
							})]
						}), /* @__PURE__ */ jsxs("label", {
							className: "text-sm font-medium text-ink",
							children: ["Result *", /* @__PURE__ */ jsxs("select", {
								value: form.data.result,
								onChange: (e) => form.setData("result", e.target.value),
								className: "mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3",
								children: [
									/* @__PURE__ */ jsx("option", {
										value: "passed",
										children: "Passed"
									}),
									/* @__PURE__ */ jsx("option", {
										value: "failed",
										children: "Failed (Moves to Under Inspection)"
									}),
									/* @__PURE__ */ jsx("option", {
										value: "conditional",
										children: "Conditional (Moves to Under Inspection)"
									})
								]
							})]
						})]
					}),
					/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("span", {
						className: "text-xs font-semibold text-ink-soft uppercase",
						children: "Inspection Checklist"
					}), /* @__PURE__ */ jsx("div", {
						className: "mt-2 grid gap-2 sm:grid-cols-3",
						children: Object.entries(form.data.checklist).map(([key, val]) => /* @__PURE__ */ jsxs("label", {
							className: "flex items-center gap-2 text-sm",
							children: [/* @__PURE__ */ jsx("input", {
								type: "checkbox",
								checked: val,
								onChange: (e) => form.setData("checklist", {
									...form.data.checklist,
									[key]: e.target.checked
								}),
								className: "h-4 w-4 rounded border-line-strong text-brand-strong"
							}), /* @__PURE__ */ jsx("span", { children: humanize(key) })]
						}, key))
					})] }),
					/* @__PURE__ */ jsx(FuelInput, {
						label: "Findings / Remarks",
						value: form.data.findings,
						error: form.errors.findings,
						onChange: (v) => form.setData("findings", v)
					}),
					/* @__PURE__ */ jsx("div", {
						className: "flex justify-end",
						children: /* @__PURE__ */ jsx(Button, {
							type: "submit",
							variant: "primary",
							disabled: form.processing,
							children: form.processing ? "Submitting…" : "Save inspection record"
						})
					})
				]
			}),
			asset.inspections.length === 0 ? /* @__PURE__ */ jsx("p", {
				className: "py-4 text-center text-sm text-ink-soft",
				children: "No inspections recorded for this asset yet."
			}) : /* @__PURE__ */ jsx("ul", {
				className: "divide-y divide-line",
				children: asset.inspections.map((ins) => /* @__PURE__ */ jsxs("li", {
					className: "py-3",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ jsxs("span", {
								className: "font-semibold text-ink capitalize",
								children: [humanize(ins.type), " inspection"]
							}), /* @__PURE__ */ jsx("span", {
								className: cn("rounded-full px-2 py-0.5 text-xs font-semibold", ins.result === "passed" ? "bg-success-soft text-success-strong" : "bg-danger-soft text-danger"),
								children: ins.result.toUpperCase()
							})]
						}),
						/* @__PURE__ */ jsxs("p", {
							className: "mt-1 text-xs text-ink-soft",
							children: ["Completed: ", formatDateTime(ins.completed_at)]
						}),
						ins.findings && /* @__PURE__ */ jsx("p", {
							className: "mt-1 text-sm text-ink-soft",
							children: ins.findings
						})
					]
				}, ins.id))
			})
		]
	});
}
function AssetMaintenanceSection({ asset, canMaintain }) {
	const [showOpenForm, setShowOpenForm] = useState(false);
	const [releasingOrderId, setReleasingOrderId] = useState(null);
	const openForm = useForm({
		defect: "",
		dispatch_blocking: true,
		remarks: ""
	});
	const releaseForm = useForm({
		work_performed: "",
		parts: "",
		remarks: ""
	});
	const submitOpen = (e) => {
		e.preventDefault();
		openForm.post(`/operations/assets/${asset.id}/maintenance`, {
			preserveScroll: true,
			onSuccess: () => {
				setShowOpenForm(false);
				openForm.reset();
			}
		});
	};
	const submitRelease = (e, orderId) => {
		e.preventDefault();
		releaseForm.transform((data) => ({
			work_performed: data.work_performed.split("\n").filter((line) => line.trim() !== ""),
			parts: data.parts.split(",").map((p) => p.trim()).filter((p) => p !== ""),
			remarks: data.remarks
		}));
		releaseForm.post(`/operations/maintenance/${orderId}/release`, {
			preserveScroll: true,
			onSuccess: () => {
				setReleasingOrderId(null);
				releaseForm.reset();
			}
		});
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "space-y-4",
		children: [
			canMaintain && /* @__PURE__ */ jsx("div", {
				className: "flex justify-end",
				children: /* @__PURE__ */ jsx(Button, {
					variant: showOpenForm ? "secondary" : "primary",
					onClick: () => setShowOpenForm(!showOpenForm),
					children: showOpenForm ? "Cancel work order" : "Open maintenance work order"
				})
			}),
			showOpenForm && canMaintain && /* @__PURE__ */ jsxs("form", {
				onSubmit: submitOpen,
				className: "space-y-4 rounded-lg border border-line bg-surface-subtle p-4",
				noValidate: true,
				children: [
					/* @__PURE__ */ jsx("h4", {
						className: "font-semibold text-ink",
						children: "Open Maintenance Work Order"
					}),
					/* @__PURE__ */ jsx(FuelInput, {
						label: "Defect description *",
						value: openForm.data.defect,
						error: openForm.errors.defect,
						onChange: (v) => openForm.setData("defect", v)
					}),
					/* @__PURE__ */ jsxs("label", {
						className: "flex items-center gap-2 text-sm font-medium text-ink",
						children: [/* @__PURE__ */ jsx("input", {
							type: "checkbox",
							checked: openForm.data.dispatch_blocking,
							onChange: (e) => openForm.setData("dispatch_blocking", e.target.checked),
							className: "h-4 w-4 rounded border-line-strong text-brand-strong"
						}), /* @__PURE__ */ jsx("span", { children: "Dispatch Blocking (Asset cannot be assigned or activated until released)" })]
					}),
					/* @__PURE__ */ jsx(FuelInput, {
						label: "Remarks / Parts needed",
						value: openForm.data.remarks,
						error: openForm.errors.remarks,
						onChange: (v) => openForm.setData("remarks", v)
					}),
					/* @__PURE__ */ jsx("div", {
						className: "flex justify-end",
						children: /* @__PURE__ */ jsx(Button, {
							type: "submit",
							variant: "primary",
							disabled: openForm.processing || !openForm.data.defect.trim(),
							children: openForm.processing ? "Opening…" : "Create work order"
						})
					})
				]
			}),
			asset.maintenance_work_orders.length === 0 ? /* @__PURE__ */ jsx("p", {
				className: "py-4 text-center text-sm text-ink-soft",
				children: "No maintenance work orders recorded for this asset."
			}) : /* @__PURE__ */ jsx("ul", {
				className: "divide-y divide-line",
				children: asset.maintenance_work_orders.map((order) => {
					const isUnreleased = !order.released_at;
					const isReleasingThis = releasingOrderId === order.id;
					return /* @__PURE__ */ jsxs("li", {
						className: "space-y-2 py-4",
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "flex flex-wrap items-center justify-between gap-2",
								children: [/* @__PURE__ */ jsxs("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ jsx("span", {
										className: "font-semibold text-ink",
										children: order.defect
									}), order.dispatch_blocking && /* @__PURE__ */ jsx("span", {
										className: "rounded bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger",
										children: "Blocking"
									})]
								}), /* @__PURE__ */ jsx("span", {
									className: "text-xs text-ink-soft",
									children: order.released_at ? `Released: ${formatDateTime(order.released_at)}` : "Open / In progress"
								})]
							}),
							order.work_performed.length > 0 && /* @__PURE__ */ jsxs("p", {
								className: "text-xs text-ink-soft",
								children: [
									"Work performed:",
									" ",
									order.work_performed.join("; ")
								]
							}),
							order.parts.length > 0 && /* @__PURE__ */ jsxs("p", {
								className: "text-xs text-ink-soft",
								children: ["Parts used: ", order.parts.join(", ")]
							}),
							isUnreleased && canMaintain && /* @__PURE__ */ jsx("div", {
								className: "pt-2",
								children: !isReleasingThis ? /* @__PURE__ */ jsx(Button, {
									variant: "secondary",
									onClick: () => setReleasingOrderId(order.id),
									children: "Release work order"
								}) : /* @__PURE__ */ jsxs("form", {
									onSubmit: (e) => submitRelease(e, order.id),
									className: "mt-2 space-y-3 rounded-lg border border-line bg-surface-subtle p-3",
									noValidate: true,
									children: [
										/* @__PURE__ */ jsx("div", {
											className: "rounded bg-warning-soft p-2 text-xs font-medium text-warning-strong",
											children: "Notice: Releasing requires a passing safety inspection completed after this order was created."
										}),
										/* @__PURE__ */ jsxs("label", {
											className: "text-sm font-medium text-ink",
											children: ["Work performed * (One task per line)", /* @__PURE__ */ jsx("textarea", {
												rows: 2,
												value: releaseForm.data.work_performed,
												onChange: (e) => releaseForm.setData("work_performed", e.target.value),
												className: "mt-1 w-full rounded-lg border border-line-strong bg-surface p-2 text-sm"
											})]
										}),
										/* @__PURE__ */ jsx(FuelInput, {
											label: "Parts used (comma separated)",
											value: releaseForm.data.parts,
											onChange: (v) => releaseForm.setData("parts", v)
										}),
										releaseForm.errors.inspection && /* @__PURE__ */ jsx("p", {
											className: "text-xs font-semibold text-danger",
											children: releaseForm.errors.inspection
										}),
										/* @__PURE__ */ jsxs("div", {
											className: "flex justify-end gap-2",
											children: [/* @__PURE__ */ jsx(Button, {
												type: "button",
												variant: "secondary",
												onClick: () => setReleasingOrderId(null),
												children: "Cancel"
											}), /* @__PURE__ */ jsx(Button, {
												type: "submit",
												variant: "primary",
												disabled: releaseForm.processing,
												children: releaseForm.processing ? "Releasing…" : "Confirm release"
											})]
										})
									]
								})
							})
						]
					}, order.id);
				})
			})
		]
	});
}
function FuelSurface({ requests, capabilities }) {
	const [pendingAction, setPendingAction] = useState(null);
	const [activeLogId, setActiveLogId] = useState(null);
	const [decisionReason, setDecisionReason] = useState({});
	const form = useForm({
		quantity_litres: "",
		fuel_type: "diesel",
		purpose: ""
	});
	const formComplete = form.data.quantity_litres.trim() !== "" && form.data.purpose.trim() !== "";
	const logForm = useForm({
		quantity_litres: "",
		odometer_km: "",
		hour_meter: "",
		price_per_litre: "",
		total_cost: "",
		fuel_station: "",
		remarks: ""
	});
	const submit = (event) => {
		event.preventDefault();
		form.post("/operations/fuel-requests", {
			preserveScroll: true,
			onSuccess: () => form.reset()
		});
	};
	const transition = (requestId, status, reason) => {
		const actionId = `${requestId}:${status}`;
		router.post(`/operations/fuel-requests/${requestId}/status`, {
			status,
			reason
		}, {
			preserveScroll: true,
			onStart: () => setPendingAction(actionId),
			onFinish: () => setPendingAction(null)
		});
	};
	const submitLog = (event, request) => {
		event.preventDefault();
		const actionId = `${request.id}:logged`;
		logForm.transform((data) => ({
			...data,
			status: "logged",
			quantity_litres: data.quantity_litres || request.quantity_litres
		}));
		logForm.post(`/operations/fuel-requests/${request.id}/status`, {
			preserveScroll: true,
			onStart: () => setPendingAction(actionId),
			onFinish: () => {
				setPendingAction(null);
				setActiveLogId(null);
				logForm.reset();
			}
		});
	};
	return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(PageHeading, {
		title: "Fuel operations",
		description: "Requests move through the canonical submitted, forwarded, approved, verified, and logged workflow."
	}), /* @__PURE__ */ jsxs("div", {
		className: "space-y-5 p-4 md:p-6",
		children: [capabilities.request_fuel && /* @__PURE__ */ jsxs(Panel, {
			className: "p-4",
			children: [
				/* @__PURE__ */ jsx("h2", {
					className: "font-semibold",
					children: "Submit fuel request"
				}),
				/* @__PURE__ */ jsx("p", {
					className: "mt-1 text-sm text-ink-soft",
					children: "The request remains scoped to its authenticated requester."
				}),
				/* @__PURE__ */ jsxs("form", {
					onSubmit: submit,
					className: "mt-4 grid gap-4 md:grid-cols-[12rem_12rem_minmax(16rem,1fr)_auto]",
					noValidate: true,
					children: [
						/* @__PURE__ */ jsx(FuelInput, {
							label: "Litres",
							type: "number",
							value: form.data.quantity_litres,
							error: form.errors.quantity_litres,
							onChange: (value) => form.setData("quantity_litres", value)
						}),
						/* @__PURE__ */ jsxs("label", {
							className: "text-sm font-medium",
							children: ["Fuel type", /* @__PURE__ */ jsxs("select", {
								value: form.data.fuel_type,
								onChange: (event) => form.setData("fuel_type", event.target.value),
								className: "mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3",
								children: [/* @__PURE__ */ jsx("option", {
									value: "diesel",
									children: "Diesel"
								}), /* @__PURE__ */ jsx("option", {
									value: "gasoline",
									children: "Gasoline"
								})]
							})]
						}),
						/* @__PURE__ */ jsx(FuelInput, {
							label: "Purpose",
							value: form.data.purpose,
							error: form.errors.purpose,
							onChange: (value) => form.setData("purpose", value)
						}),
						/* @__PURE__ */ jsx("div", {
							className: "flex flex-col justify-end",
							children: /* @__PURE__ */ jsx(Button, {
								type: "submit",
								variant: "primary",
								disabled: form.processing || !formComplete,
								children: form.processing ? "Submitting…" : "Submit request"
							})
						})
					]
				})
			]
		}), /* @__PURE__ */ jsx(Panel, {
			className: "overflow-hidden",
			children: requests.length === 0 ? /* @__PURE__ */ jsx(EmptyState, {
				icon: Fuel,
				title: "No fuel requests available",
				message: capabilities.request_fuel ? "Submit a request above when fuel is required for assigned work." : "Requests visible to your role will appear here."
			}) : /* @__PURE__ */ jsx("ul", {
				className: "divide-y divide-line",
				children: requests.map((request) => {
					const nextAction = getFuelAction(request, capabilities);
					const actionId = nextAction ? `${request.id}:${nextAction.status}` : null;
					const isLoggingThis = activeLogId === request.id;
					return /* @__PURE__ */ jsxs("li", {
						className: "flex flex-col gap-4 px-4 py-4",
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
								children: [/* @__PURE__ */ jsxs("div", {
									className: "min-w-0 flex-1",
									children: [
										/* @__PURE__ */ jsxs("div", {
											className: "flex flex-wrap items-center gap-2",
											children: [/* @__PURE__ */ jsx("p", {
												className: "font-semibold",
												children: request.reference
											}), /* @__PURE__ */ jsx(CanonicalStatusBadge, { status: request.status })]
										}),
										/* @__PURE__ */ jsxs("p", {
											className: "mt-1 text-sm text-ink-soft",
											children: [
												request.quantity_litres,
												" L ·",
												" ",
												humanize(request.fuel_type),
												" ",
												"· ",
												request.purpose
											]
										}),
										/* @__PURE__ */ jsxs("p", {
											className: "mt-1 text-xs text-ink-soft",
											children: [
												"Requested by",
												" ",
												request.requester.name,
												request.asset ? ` · Asset: ${request.asset.code}` : "",
												request.job ? ` · Job: ${request.job.reference}` : ""
											]
										}),
										request.decision_reason && /* @__PURE__ */ jsxs("p", {
											className: "mt-1 text-xs text-ink-soft italic",
											children: [
												"Reason:",
												" ",
												request.decision_reason
											]
										})
									]
								}), /* @__PURE__ */ jsxs("div", {
									className: "flex flex-wrap items-center gap-2",
									children: [
										nextAction && nextAction.status === "approved" && capabilities.approve_fuel && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(Button, {
											variant: "secondary",
											onClick: () => transition(request.id, "approved", decisionReason[request.id]),
											disabled: pendingAction !== null,
											children: pendingAction === `${request.id}:approved` ? "Approving…" : "Approve"
										}), /* @__PURE__ */ jsx(Button, {
											variant: "danger",
											onClick: () => transition(request.id, "rejected", decisionReason[request.id]),
											disabled: pendingAction !== null,
											children: pendingAction === `${request.id}:rejected` ? "Rejecting…" : "Reject"
										})] }),
										nextAction && nextAction.status === "logged" && capabilities.record_fuel && !isLoggingThis && /* @__PURE__ */ jsx(Button, {
											variant: "secondary",
											onClick: () => {
												setActiveLogId(request.id);
												logForm.setData("quantity_litres", request.quantity_litres);
											},
											children: "Record fuel log"
										}),
										nextAction && nextAction.status !== "approved" && nextAction.status !== "logged" && actionId && /* @__PURE__ */ jsx(Button, {
											variant: "secondary",
											onClick: () => transition(request.id, nextAction.status),
											disabled: pendingAction !== null,
											children: pendingAction === actionId ? `${nextAction.label}…` : nextAction.label
										})
									]
								})]
							}),
							nextAction && nextAction.status === "approved" && capabilities.approve_fuel && /* @__PURE__ */ jsxs("div", {
								className: "mt-2",
								children: [/* @__PURE__ */ jsxs("label", {
									htmlFor: `fuel-decision-reason-${request.id}`,
									className: "sr-only",
									children: [
										"Decision reason for",
										" ",
										request.reference
									]
								}), /* @__PURE__ */ jsx("input", {
									id: `fuel-decision-reason-${request.id}`,
									type: "text",
									placeholder: "Decision reason (optional for approval, recommended for rejection)",
									value: decisionReason[request.id] || "",
									onChange: (e) => setDecisionReason({
										...decisionReason,
										[request.id]: e.target.value
									}),
									className: "h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-xs"
								})]
							}),
							isLoggingThis && /* @__PURE__ */ jsxs(Panel, {
								className: "mt-3 bg-surface-subtle p-4",
								children: [/* @__PURE__ */ jsx("h3", {
									className: "text-sm font-semibold",
									children: "Record final fuel log"
								}), /* @__PURE__ */ jsxs("form", {
									onSubmit: (e) => submitLog(e, request),
									className: "mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-3",
									children: [
										/* @__PURE__ */ jsx(FuelInput, {
											label: "Litres",
											type: "number",
											value: logForm.data.quantity_litres,
											onChange: (val) => logForm.setData("quantity_litres", val)
										}),
										/* @__PURE__ */ jsx(FuelInput, {
											label: "Odometer (km)",
											type: "number",
											value: logForm.data.odometer_km,
											onChange: (val) => logForm.setData("odometer_km", val)
										}),
										/* @__PURE__ */ jsx(FuelInput, {
											label: "Hour meter",
											type: "number",
											value: logForm.data.hour_meter,
											onChange: (val) => logForm.setData("hour_meter", val)
										}),
										/* @__PURE__ */ jsx(FuelInput, {
											label: "Price / Litre",
											type: "number",
											value: logForm.data.price_per_litre,
											onChange: (val) => logForm.setData("price_per_litre", val)
										}),
										/* @__PURE__ */ jsx(FuelInput, {
											label: "Fuel Station",
											value: logForm.data.fuel_station,
											onChange: (val) => logForm.setData("fuel_station", val)
										}),
										/* @__PURE__ */ jsx(FuelInput, {
											label: "Remarks",
											value: logForm.data.remarks,
											onChange: (val) => logForm.setData("remarks", val)
										}),
										/* @__PURE__ */ jsxs("div", {
											className: "col-span-full flex items-center justify-end gap-2 pt-2",
											children: [/* @__PURE__ */ jsx(Button, {
												type: "button",
												variant: "quiet",
												onClick: () => setActiveLogId(null),
												children: "Cancel"
											}), /* @__PURE__ */ jsx(Button, {
												type: "submit",
												variant: "primary",
												disabled: logForm.processing,
												children: logForm.processing ? "Saving log…" : "Submit fuel log"
											})]
										})
									]
								})]
							}),
							request.logs && request.logs.length > 0 && /* @__PURE__ */ jsxs("div", {
								className: "mt-2 space-y-1 rounded-lg border border-line bg-surface-subtle p-3 text-xs",
								children: [/* @__PURE__ */ jsx("p", {
									className: "font-semibold text-ink",
									children: "Fuel Log Details:"
								}), request.logs.map((log) => /* @__PURE__ */ jsxs("div", {
									className: "grid grid-cols-2 gap-2 text-ink-soft sm:grid-cols-4",
									children: [
										/* @__PURE__ */ jsxs("span", { children: [
											/* @__PURE__ */ jsx("strong", { children: "Quantity:" }),
											" ",
											log.quantity_litres,
											" ",
											"L"
										] }),
										/* @__PURE__ */ jsxs("span", { children: [
											/* @__PURE__ */ jsx("strong", { children: "Station:" }),
											" ",
											log.fuel_station || "N/A"
										] }),
										/* @__PURE__ */ jsxs("span", { children: [
											/* @__PURE__ */ jsx("strong", { children: "Cost:" }),
											" ",
											log.total_cost ? `$${log.total_cost}` : "N/A"
										] }),
										/* @__PURE__ */ jsxs("span", { children: [
											/* @__PURE__ */ jsx("strong", { children: "Recorded by:" }),
											" ",
											log.recorded_by?.name || "N/A"
										] }),
										log.odometer_km !== null && /* @__PURE__ */ jsxs("span", { children: [
											/* @__PURE__ */ jsx("strong", { children: "Odometer:" }),
											" ",
											log.odometer_km,
											" ",
											"km"
										] }),
										log.hour_meter !== null && /* @__PURE__ */ jsxs("span", { children: [
											/* @__PURE__ */ jsx("strong", { children: "Hours:" }),
											" ",
											log.hour_meter
										] }),
										log.remarks && /* @__PURE__ */ jsxs("span", {
											className: "col-span-2",
											children: [
												/* @__PURE__ */ jsx("strong", { children: "Remarks:" }),
												" ",
												log.remarks
											]
										})
									]
								}, log.id))]
							})
						]
					}, request.id);
				})
			})
		})]
	})] });
}
function ApprovalsSurface({ approvals, canDecide }) {
	return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(PageHeading, {
		title: "Pending approvals",
		description: "Review the requester, job plan, schedule, and proposed resources before recording an independent decision."
	}), /* @__PURE__ */ jsx("div", {
		className: "p-4 md:p-6",
		children: approvals.length === 0 ? /* @__PURE__ */ jsx(Panel, { children: /* @__PURE__ */ jsx(EmptyState, {
			icon: ShieldCheck,
			title: "No approvals need attention",
			message: "Exceptional changes awaiting an independent decision will appear here."
		}) }) : /* @__PURE__ */ jsx("div", {
			className: "grid gap-4 xl:grid-cols-2",
			children: approvals.map((approval) => /* @__PURE__ */ jsx(ApprovalReviewCard, {
				approval,
				canDecide: canDecide && approval.can_decide
			}, approval.id))
		})
	})] });
}
function ApprovalReviewCard({ approval, canDecide }) {
	const form = useForm({
		status: "approved",
		reason: ""
	});
	const [pendingDecision, setPendingDecision] = useState(null);
	const reasonId = `approval-${approval.id}-reason`;
	const errorId = `${reasonId}-error`;
	const personnel = approval.requested_changes.personnel;
	const assets = approval.requested_changes.assets;
	const endedPersonnel = approval.requested_changes.ended_personnel;
	const endedAssets = approval.requested_changes.ended_assets;
	const approvalError = form.errors.approval ?? form.errors.version ?? form.errors.personnel ?? form.errors.assets ?? null;
	const decide = (status) => {
		form.transform((data) => ({
			...data,
			status
		}));
		form.post(`/operations/approval-requests/${approval.id}/decision`, {
			preserveScroll: true,
			onStart: () => setPendingDecision(status),
			onFinish: () => setPendingDecision(null)
		});
	};
	return /* @__PURE__ */ jsxs(Panel, {
		className: "overflow-hidden",
		children: [/* @__PURE__ */ jsx("div", {
			className: "border-b border-line px-4 py-4",
			children: /* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap items-start justify-between gap-3",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "min-w-0",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "flex flex-wrap items-center gap-2",
							children: [approval.subject.priority && /* @__PURE__ */ jsx(CanonicalStatusBadge, { status: approval.subject.priority }), /* @__PURE__ */ jsx(CanonicalStatusBadge, { status: approval.status })]
						}),
						/* @__PURE__ */ jsx("h2", {
							className: "mt-2 font-semibold",
							children: approval.subject.title ?? approval.subject.reference
						}),
						/* @__PURE__ */ jsxs("p", {
							className: "mt-1 text-sm text-ink-soft",
							children: [
								approval.subject.reference,
								" · Requested by",
								" ",
								approval.requester.name
							]
						})
					]
				}), /* @__PURE__ */ jsx("span", {
					className: "rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-medium text-ink-soft",
					children: humanize(approval.kind)
				})]
			})
		}), /* @__PURE__ */ jsxs("div", {
			className: "space-y-4 px-4 py-4",
			children: [
				/* @__PURE__ */ jsxs("dl", {
					className: "grid gap-3 text-sm sm:grid-cols-2",
					children: [
						/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("dt", {
							className: "text-xs font-medium text-ink-soft",
							children: "Schedule"
						}), /* @__PURE__ */ jsxs("dd", {
							className: "mt-1 font-medium",
							children: [
								formatDateTime(approval.subject.scheduled_start),
								" –",
								" ",
								formatDateTime(approval.subject.scheduled_end)
							]
						})] }),
						/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("dt", {
							className: "text-xs font-medium text-ink-soft",
							children: "Site"
						}), /* @__PURE__ */ jsx("dd", {
							className: "mt-1 font-medium",
							children: approval.subject.site ?? "Not recorded"
						})] }),
						/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("dt", {
							className: "text-xs font-medium text-ink-soft",
							children: "Dispatch state"
						}), /* @__PURE__ */ jsxs("dd", {
							className: "mt-1 flex flex-wrap items-center gap-2",
							children: [approval.subject.status && /* @__PURE__ */ jsx(CanonicalStatusBadge, { status: approval.subject.status }), approval.subject.version !== null && /* @__PURE__ */ jsxs("span", {
								className: "text-xs text-ink-soft",
								children: ["Version ", approval.subject.version]
							})]
						})] }),
						/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("dt", {
							className: "text-xs font-medium text-ink-soft",
							children: "Requested"
						}), /* @__PURE__ */ jsx("dd", {
							className: "mt-1 font-medium",
							children: formatDateTime(approval.created_at)
						})] })
					]
				}),
				approval.subject.site_notes?.trim() && /* @__PURE__ */ jsxs("div", {
					className: "rounded-lg bg-surface-subtle p-3",
					children: [/* @__PURE__ */ jsx("p", {
						className: "text-xs font-semibold",
						children: "Site note"
					}), /* @__PURE__ */ jsx("p", {
						className: "mt-1 text-sm leading-6 text-ink-soft",
						children: approval.subject.site_notes
					})]
				}),
				/* @__PURE__ */ jsxs("div", { children: [
					/* @__PURE__ */ jsx("h3", {
						className: "text-sm font-semibold",
						children: "Proposed resource changes"
					}),
					endedPersonnel.length > 0 && /* @__PURE__ */ jsxs("div", {
						className: "mt-2",
						children: [/* @__PURE__ */ jsx("p", {
							className: "text-xs font-medium text-ink-soft",
							children: "Ending active personnel assignments"
						}), /* @__PURE__ */ jsx("ul", {
							className: "mt-2 grid gap-2 sm:grid-cols-2",
							children: endedPersonnel.map((person) => /* @__PURE__ */ jsxs("li", {
								className: "rounded-lg border border-line px-3 py-2 text-sm",
								children: [/* @__PURE__ */ jsx("p", {
									className: "font-medium",
									children: person.name
								}), /* @__PURE__ */ jsx("p", {
									className: "mt-0.5 text-xs text-ink-soft",
									children: humanize(person.assignment_type)
								})]
							}, `ended-personnel-${person.id}`))
						})]
					}),
					endedAssets.length > 0 && /* @__PURE__ */ jsxs("div", {
						className: "mt-3",
						children: [/* @__PURE__ */ jsx("p", {
							className: "text-xs font-medium text-ink-soft",
							children: "Ending active asset assignments"
						}), /* @__PURE__ */ jsx("ul", {
							className: "mt-2 grid gap-2 sm:grid-cols-2",
							children: endedAssets.map((asset) => /* @__PURE__ */ jsxs("li", {
								className: "rounded-lg border border-line px-3 py-2 text-sm",
								children: [/* @__PURE__ */ jsxs("p", {
									className: "font-medium",
									children: [
										asset.code,
										" · ",
										asset.name
									]
								}), /* @__PURE__ */ jsx("p", {
									className: "mt-0.5 text-xs text-ink-soft",
									children: humanize(asset.assignment_type)
								})]
							}, `ended-asset-${asset.id}`))
						})]
					}),
					personnel.length > 0 || assets.length > 0 ? /* @__PURE__ */ jsxs("div", {
						className: "mt-3",
						children: [/* @__PURE__ */ jsx("p", {
							className: "text-xs font-medium text-ink-soft",
							children: "Adding replacement resources"
						}), /* @__PURE__ */ jsxs("ul", {
							className: "mt-2 grid gap-2 sm:grid-cols-2",
							children: [personnel.map((person) => /* @__PURE__ */ jsxs("li", {
								className: "rounded-lg border border-line px-3 py-2 text-sm",
								children: [/* @__PURE__ */ jsx("p", {
									className: "font-medium",
									children: person.name
								}), /* @__PURE__ */ jsx("p", {
									className: "mt-0.5 text-xs text-ink-soft",
									children: humanize(person.assignment_type)
								})]
							}, `personnel-${person.id}`)), assets.map((asset) => /* @__PURE__ */ jsxs("li", {
								className: "rounded-lg border border-line px-3 py-2 text-sm",
								children: [/* @__PURE__ */ jsxs("p", {
									className: "font-medium",
									children: [
										asset.code,
										" · ",
										asset.name
									]
								}), /* @__PURE__ */ jsx("p", {
									className: "mt-0.5 text-xs text-ink-soft",
									children: humanize(asset.assignment_type)
								})]
							}, `asset-${asset.id}`))]
						})]
					}) : endedPersonnel.length === 0 && endedAssets.length === 0 ? /* @__PURE__ */ jsx("p", {
						className: "mt-2 text-sm text-ink-soft",
						children: "This request covers dispatch activation without a new resource batch."
					}) : null
				] }),
				canDecide ? /* @__PURE__ */ jsxs("div", {
					className: "border-t border-line pt-4",
					children: [
						approvalError && /* @__PURE__ */ jsx("div", {
							className: "mb-3 rounded-lg border border-danger bg-danger-soft px-3 py-3 text-sm text-danger",
							role: "alert",
							children: approvalError
						}),
						/* @__PURE__ */ jsx("label", {
							htmlFor: reasonId,
							className: "text-sm font-medium",
							children: "Decision reason"
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mt-1 text-xs text-ink-soft",
							children: "Required for both approval and rejection. This reason becomes part of the audit history."
						}),
						/* @__PURE__ */ jsx("textarea", {
							id: reasonId,
							value: form.data.reason,
							onChange: (event) => form.setData("reason", event.target.value),
							rows: 3,
							required: true,
							maxLength: 2e3,
							"aria-invalid": form.errors.reason ? "true" : void 0,
							"aria-describedby": form.errors.reason ? errorId : void 0,
							className: cn("mt-2 w-full resize-y rounded-lg border bg-surface px-3 py-2 text-sm", form.errors.reason ? "border-danger" : "border-line-strong")
						}),
						form.errors.reason && /* @__PURE__ */ jsx("p", {
							id: errorId,
							className: "mt-1 text-xs text-danger",
							role: "alert",
							children: form.errors.reason
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
							children: [/* @__PURE__ */ jsx(Button, {
								variant: "danger",
								onClick: () => decide("rejected"),
								disabled: form.processing || form.data.reason.trim().length === 0,
								children: form.processing && pendingDecision === "rejected" ? "Rejecting…" : "Reject request"
							}), /* @__PURE__ */ jsx(Button, {
								variant: "primary",
								onClick: () => decide("approved"),
								disabled: form.processing || form.data.reason.trim().length === 0,
								children: form.processing && pendingDecision === "approved" ? "Approving…" : "Approve request"
							})]
						})
					]
				}) : /* @__PURE__ */ jsxs("div", {
					className: "rounded-lg border border-warning bg-warning-soft px-3 py-3 text-sm text-warning-strong",
					role: "status",
					children: [/* @__PURE__ */ jsx("p", {
						className: "font-semibold",
						children: "Independent review needed"
					}), /* @__PURE__ */ jsx("p", {
						className: "mt-1",
						children: approval.decision_blocker ?? "Another authorized manager must decide this request."
					})]
				})
			]
		})]
	});
}
function UsersSurface({ users }) {
	return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(PageHeading, {
		title: "Users and roles",
		description: "Operational users receive one canonical role; this Phase 1 surface is intentionally read-only."
	}), /* @__PURE__ */ jsx("div", {
		className: "p-4 md:p-6",
		children: users.length === 0 ? /* @__PURE__ */ jsx(Panel, { children: /* @__PURE__ */ jsx(EmptyState, {
			icon: Users,
			title: "No users available",
			message: "Operational users will appear after an administrator adds them."
		}) }) : /* @__PURE__ */ jsx(ResponsiveTable, {
			headers: [
				"Name",
				"Email",
				"Role",
				"Status"
			],
			rows: users.map((user) => ({
				key: user.id,
				cells: [
					/* @__PURE__ */ jsx("span", {
						className: "font-semibold",
						children: user.name
					}),
					user.email,
					user.role_label ?? "Unassigned",
					/* @__PURE__ */ jsx("span", {
						className: user.is_active ? "text-success-strong" : "text-danger",
						children: user.is_active ? "Active" : "Suspended"
					})
				]
			}))
		})
	})] });
}
function AuditSurface({ events }) {
	return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(PageHeading, {
		title: "Audit trail",
		description: "Approvals, overrides, state changes, and access decisions remain attributable."
	}), /* @__PURE__ */ jsx("div", {
		className: "p-4 md:p-6",
		children: events.length === 0 ? /* @__PURE__ */ jsx(Panel, { children: /* @__PURE__ */ jsx(EmptyState, {
			icon: Bot,
			title: "No audit events recorded",
			message: "Sensitive operational and access changes will appear here."
		}) }) : /* @__PURE__ */ jsx(ResponsiveTable, {
			headers: [
				"Time",
				"Actor",
				"Action",
				"Reason"
			],
			rows: events.map((event) => ({
				key: event.id,
				cells: [
					formatDateTime(event.occurred_at),
					event.actor?.name ?? "System",
					humanize(event.action),
					event.reason ?? "No reason recorded"
				]
			}))
		})
	})] });
}
function ResponsiveTable({ headers, rows }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "overflow-hidden rounded-xl border border-line bg-surface",
		children: [/* @__PURE__ */ jsx("div", {
			className: "divide-y divide-line md:hidden",
			children: rows.map((row) => /* @__PURE__ */ jsx("dl", {
				className: "space-y-2 px-4 py-3",
				children: row.cells.map((cell, index) => /* @__PURE__ */ jsxs("div", {
					className: "grid grid-cols-[minmax(7rem,0.7fr)_minmax(0,1fr)] gap-3 text-sm",
					children: [/* @__PURE__ */ jsx("dt", {
						className: "text-ink-soft",
						children: headers[index]
					}), /* @__PURE__ */ jsx("dd", {
						className: "min-w-0 text-right text-ink",
						children: cell
					})]
				}, headers[index]))
			}, row.key))
		}), /* @__PURE__ */ jsx("div", {
			className: "hidden overflow-x-auto md:block",
			children: /* @__PURE__ */ jsxs("table", {
				className: "w-full text-left text-sm",
				children: [/* @__PURE__ */ jsx("thead", {
					className: "bg-surface-subtle text-ink-soft",
					children: /* @__PURE__ */ jsx("tr", { children: headers.map((header) => /* @__PURE__ */ jsx("th", {
						scope: "col",
						className: "px-4 py-3 font-medium",
						children: header
					}, header)) })
				}), /* @__PURE__ */ jsx("tbody", { children: rows.map((row) => /* @__PURE__ */ jsx("tr", {
					className: "border-t border-line",
					children: row.cells.map((cell, index) => /* @__PURE__ */ jsx("td", {
						className: "px-4 py-3",
						children: cell
					}, headers[index]))
				}, row.key)) })]
			})
		})]
	});
}
function FuelInput({ label, value, onChange, error, type = "text" }) {
	return /* @__PURE__ */ jsxs("label", {
		className: "text-sm font-medium",
		children: [
			label,
			/* @__PURE__ */ jsx("input", {
				type,
				value,
				onChange: (event) => onChange(event.target.value),
				"aria-invalid": error ? "true" : void 0,
				className: cn("mt-1 h-11 w-full rounded-lg border bg-surface px-3", error ? "border-danger" : "border-line-strong")
			}),
			error && /* @__PURE__ */ jsx("span", {
				className: "mt-1 block text-xs text-danger",
				children: error
			})
		]
	});
}
function getFuelAction(request, capabilities) {
	if (capabilities.forward_fuel && request.status.value === "submitted") return {
		status: "forwarded",
		label: "Forward request"
	};
	if (capabilities.approve_fuel && request.status.value === "forwarded") return {
		status: "approved",
		label: "Approve request"
	};
	if (capabilities.verify_fuel && request.status.value === "approved") return {
		status: "verified",
		label: "Verify request"
	};
	if (capabilities.record_fuel && request.status.value === "verified") return {
		status: "logged",
		label: "Record fuel log"
	};
	return null;
}
function humanize(value) {
	return value.replaceAll("_", " ");
}
function formatDateTime(value) {
	if (value === null) return "Not recorded";
	return new Intl.DateTimeFormat(void 0, {
		dateStyle: "medium",
		timeStyle: "short"
	}).format(new Date(value));
}
//#endregion
//#region resources/js/components/workspace/live-workspace-shell.tsx
var sectionIcons = {
	overview: LayoutDashboard,
	dispatch: ClipboardList,
	assets: Truck,
	fuel: Fuel,
	tracking: MapPin,
	approvals: ShieldCheck,
	users: Users,
	audit: Bot
};
function LiveWorkspaceShell({ navigation, section, stale, refreshing, canShareLocation, locationPending, onSectionChange, onRefresh, onShareLocation, children }) {
	const { auth } = usePage().props;
	const [collapsed, setCollapsed] = useState(false);
	const [mobileOpen, setMobileOpen] = useState(false);
	return /* @__PURE__ */ jsxs("div", {
		className: "min-h-screen bg-canvas text-ink md:grid md:grid-cols-[auto_minmax(0,1fr)]",
		children: [
			/* @__PURE__ */ jsx("a", {
				href: "#workspace-content",
				className: "sr-only z-[70] rounded-lg bg-ink px-4 py-3 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2",
				children: "Skip to workspace"
			}),
			mobileOpen && /* @__PURE__ */ jsx("button", {
				type: "button",
				className: "fixed inset-0 z-40 bg-ink/35 md:hidden",
				onClick: () => setMobileOpen(false),
				"aria-label": "Close navigation"
			}),
			/* @__PURE__ */ jsxs("aside", {
				id: "workspace-navigation",
				className: cn("fixed inset-y-0 left-0 z-50 flex h-screen w-[15.5rem] flex-col border-r border-white/10 bg-ink text-white transition-transform duration-200 ease-out md:sticky md:top-0 md:translate-x-0", mobileOpen ? "translate-x-0" : "-translate-x-full", collapsed && "md:w-[4.75rem]"),
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: cn("flex h-[4.5rem] items-center border-b border-white/10 px-4", collapsed ? "justify-center" : "gap-3"),
						children: [
							/* @__PURE__ */ jsx("div", {
								className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-semibold text-brand-contrast",
								children: "C2"
							}),
							!collapsed && /* @__PURE__ */ jsxs("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ jsx("p", {
									className: "truncate text-sm font-semibold",
									children: "Core Transaction 2"
								}), /* @__PURE__ */ jsx("p", {
									className: "truncate text-xs text-white/65",
									children: auth.role_label
								})]
							}),
							/* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: () => setMobileOpen(false),
								className: "flex h-11 w-11 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white md:hidden",
								"aria-label": "Close navigation",
								children: /* @__PURE__ */ jsx(X, {
									className: "h-5 w-5",
									"aria-hidden": "true"
								})
							})
						]
					}),
					/* @__PURE__ */ jsxs("nav", {
						className: "flex-1 overflow-y-auto p-3",
						"aria-label": "Available operations modules",
						children: [!collapsed && /* @__PURE__ */ jsx("p", {
							className: "px-3 pb-2 text-xs font-medium text-white/55",
							children: "Available to your account"
						}), /* @__PURE__ */ jsx("ul", {
							className: "space-y-1",
							children: navigation.map((item) => {
								const Icon = sectionIcons[item.id];
								const active = item.id === section;
								return /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs("button", {
									type: "button",
									onClick: () => {
										onSectionChange(item.id);
										setMobileOpen(false);
									},
									className: cn("relative flex min-h-11 w-full items-center rounded-lg text-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none", collapsed ? "justify-center" : "gap-3 px-3", active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white"),
									"aria-current": active ? "page" : void 0,
									"aria-label": collapsed ? item.label : void 0,
									title: collapsed ? item.label : void 0,
									children: [
										active && /* @__PURE__ */ jsx("span", {
											className: "absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand",
											"aria-hidden": "true"
										}),
										/* @__PURE__ */ jsx(Icon, {
											className: "h-5 w-5 shrink-0",
											"aria-hidden": "true"
										}),
										!collapsed && /* @__PURE__ */ jsx("span", {
											className: "text-left font-medium",
											children: item.label
										})
									]
								}) }, item.id);
							})
						})]
					}),
					/* @__PURE__ */ jsx("div", {
						className: "border-t border-white/10 p-3",
						children: /* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => setCollapsed((value) => !value),
							className: cn("hidden min-h-11 w-full items-center rounded-lg text-sm text-white/65 hover:bg-white/5 hover:text-white md:flex", collapsed ? "justify-center" : "gap-3 px-3"),
							"aria-label": collapsed ? "Expand navigation" : "Collapse navigation",
							"aria-expanded": !collapsed,
							children: collapsed ? /* @__PURE__ */ jsx(ChevronRight, {
								className: "h-5 w-5",
								"aria-hidden": "true"
							}) : /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(ChevronLeft, {
								className: "h-5 w-5",
								"aria-hidden": "true"
							}), "Collapse navigation"] })
						})
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "min-w-0",
				children: [/* @__PURE__ */ jsxs("header", {
					className: "sticky top-0 z-30 flex min-h-[4.5rem] items-center gap-2 border-b border-line bg-surface px-4 md:px-6",
					children: [
						/* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => setMobileOpen(true),
							className: "flex h-11 w-11 items-center justify-center rounded-lg hover:bg-surface-subtle md:hidden",
							"aria-label": "Open navigation",
							"aria-expanded": mobileOpen,
							"aria-controls": "workspace-navigation",
							children: /* @__PURE__ */ jsx(Menu, {
								className: "h-5 w-5",
								"aria-hidden": "true"
							})
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ jsx("p", {
								className: "truncate text-sm font-medium",
								children: auth.user?.name
							}), /* @__PURE__ */ jsx("p", {
								className: "truncate text-xs text-ink-soft",
								children: stale ? "Workspace data may be stale" : "Live Laravel workspace"
							})]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "ml-auto flex items-center gap-1 sm:gap-2",
							children: [
								canShareLocation && /* @__PURE__ */ jsxs(Button, {
									variant: "quiet",
									onClick: onShareLocation,
									disabled: locationPending,
									"aria-label": locationPending ? "Sharing current location" : "Share current location",
									children: [/* @__PURE__ */ jsx(MapPin, {
										className: "h-4 w-4",
										"aria-hidden": "true"
									}), /* @__PURE__ */ jsx("span", {
										className: "hidden sm:inline",
										children: locationPending ? "Sharing…" : "Share location"
									})]
								}),
								/* @__PURE__ */ jsx(Button, {
									size: "icon",
									variant: "quiet",
									onClick: onRefresh,
									disabled: refreshing,
									"aria-label": refreshing ? "Refreshing workspace" : "Refresh workspace",
									title: "Refresh workspace",
									children: /* @__PURE__ */ jsx(RefreshCw, {
										className: cn("h-5 w-5", refreshing && "animate-spin"),
										"aria-hidden": "true"
									})
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
				}), /* @__PURE__ */ jsx("main", {
					id: "workspace-content",
					className: "min-w-0",
					children
				})]
			})
		]
	});
}
//#endregion
//#region resources/js/pages/workspace.tsx
function Workspace(props) {
	const { flash, errors } = usePage().props;
	const [section, setSection] = useState(() => initialSection(props.navigation));
	const [refreshing, setRefreshing] = useState(false);
	const [locationPending, setLocationPending] = useState(false);
	const [locationError, setLocationError] = useState(null);
	const [currentTime, setCurrentTime] = useState(() => Date.now());
	const availableSection = props.navigation.some((item) => item.id === section) ? section : props.navigation[0]?.id ?? null;
	const stale = isStale(props.workspace.refreshed_at, props.workspace.stale_after_seconds, currentTime);
	useEffect(() => {
		const timer = window.setInterval(() => setCurrentTime(Date.now()), 15e3);
		return () => window.clearInterval(timer);
	}, []);
	const changeSection = (nextSection) => {
		setSection(nextSection);
		const url = new URL(window.location.href);
		url.searchParams.set("view", nextSection);
		window.history.replaceState({}, "", url);
	};
	const refresh = () => router.reload({
		onStart: () => setRefreshing(true),
		onFinish: () => setRefreshing(false)
	});
	const shareLocation = () => {
		setLocationError(null);
		if (!("geolocation" in navigator)) {
			setLocationError("Location sharing is not supported by this browser.");
			return;
		}
		setLocationPending(true);
		const commandId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
		navigator.geolocation.getCurrentPosition((position) => router.post("/operations/locations", {
			latitude: position.coords.latitude,
			longitude: position.coords.longitude,
			accuracy_metres: position.coords.accuracy,
			captured_at: new Date(position.timestamp).toISOString(),
			sharing_enabled: true,
			command_id: commandId
		}, {
			preserveScroll: true,
			onError: () => setLocationError("The location could not be saved. Review the form message and try again."),
			onFinish: () => setLocationPending(false)
		}), (error) => {
			setLocationPending(false);
			setLocationError(locationErrorMessage(error.code));
		}, {
			enableHighAccuracy: true,
			maximumAge: 3e4,
			timeout: 15e3
		});
	};
	const validationErrorCount = Object.keys(errors).length;
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(Head, { title: "Operations workspace" }), /* @__PURE__ */ jsxs(LiveWorkspaceShell, {
		navigation: props.navigation,
		section: availableSection,
		stale,
		refreshing,
		canShareLocation: props.capabilities.share_location,
		locationPending,
		onSectionChange: changeSection,
		onRefresh: refresh,
		onShareLocation: shareLocation,
		children: [(flash || locationError || validationErrorCount > 0 || stale) && /* @__PURE__ */ jsxs("div", {
			className: "space-y-2 border-b border-line bg-surface px-4 py-3 md:px-6",
			children: [
				flash && /* @__PURE__ */ jsx(FlashNotice, { flash }),
				locationError && /* @__PURE__ */ jsx(StateNotice, {
					tone: "error",
					message: locationError,
					onDismiss: () => setLocationError(null)
				}),
				validationErrorCount > 0 && /* @__PURE__ */ jsx(StateNotice, {
					tone: "error",
					message: `${validationErrorCount} field${validationErrorCount === 1 ? "" : "s"} need attention. Your entries were preserved.`
				}),
				stale && /* @__PURE__ */ jsx(StateNotice, {
					tone: "warning",
					message: "This workspace has not refreshed recently. Review current data before making an operational decision.",
					action: /* @__PURE__ */ jsx(Button, {
						size: "sm",
						variant: "secondary",
						onClick: refresh,
						disabled: refreshing,
						children: refreshing ? "Refreshing…" : "Refresh now"
					})
				})
			]
		}), availableSection === null ? /* @__PURE__ */ jsx("div", {
			className: "p-4 md:p-6",
			children: /* @__PURE__ */ jsx(Panel, { children: /* @__PURE__ */ jsx(EmptyState, {
				icon: LockKeyhole,
				title: "No workspace modules available",
				message: "Your account is active, but it has no operational capabilities. Ask an administrator to review the assigned role."
			}) })
		}) : availableSection === "overview" ? /* @__PURE__ */ jsx(OperationsOverviewDashboard, {
			jobs: props.jobs,
			assets: props.assets,
			fuelRequests: props.fuelRequests,
			locations: props.locations ?? [],
			approvals: props.approvals,
			capabilities: props.capabilities,
			availableSections: props.navigation.map((item) => item.id),
			onSectionChange: changeSection
		}) : availableSection === "dispatch" ? /* @__PURE__ */ jsx(LiveDispatchWorkspace, {
			jobs: props.jobs,
			clients: props.clients,
			serviceRequests: props.serviceRequests,
			assets: props.assets,
			approvals: props.approvals,
			users: props.users,
			gptRecommendations: props.gptRecommendations,
			capabilities: props.capabilities,
			canCreate: props.capabilities.create_dispatch,
			refreshing
		}) : /* @__PURE__ */ jsx(LiveWorkspaceSection, {
			section: availableSection,
			assets: props.assets,
			fuelRequests: props.fuelRequests,
			locations: props.locations ?? [],
			approvals: props.approvals,
			users: props.users,
			auditEvents: props.auditEvents,
			capabilities: props.capabilities
		})]
	})] });
}
function FlashNotice({ flash }) {
	return /* @__PURE__ */ jsx(StateNotice, {
		tone: flash.tone,
		message: flash.message
	});
}
function StateNotice({ tone, message, onDismiss, action }) {
	const Icon = tone === "success" ? Check : tone === "warning" ? AlertTriangle : tone === "error" ? X : Info;
	return /* @__PURE__ */ jsxs("div", {
		className: cn("flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm", tone === "success" && "bg-success-soft text-success-strong", tone === "warning" && "bg-warning-soft text-warning-strong", tone === "error" && "bg-danger-soft text-danger", tone === "info" && "bg-info-soft text-info-strong"),
		role: tone === "error" ? "alert" : "status",
		children: [
			/* @__PURE__ */ jsx(Icon, {
				className: "mt-0.5 h-4 w-4 shrink-0",
				"aria-hidden": "true"
			}),
			/* @__PURE__ */ jsx("p", {
				className: "min-w-0 flex-1 leading-5",
				children: message
			}),
			action,
			onDismiss && /* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: onDismiss,
				className: "-m-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-black/5",
				"aria-label": "Dismiss message",
				children: /* @__PURE__ */ jsx(X, {
					className: "h-4 w-4",
					"aria-hidden": "true"
				})
			})
		]
	});
}
function initialSection(navigation) {
	if (typeof window === "undefined") return navigation[0]?.id ?? null;
	const requested = new URLSearchParams(window.location.search).get("view");
	return navigation.find((item) => item.id === requested)?.id ?? navigation[0]?.id ?? null;
}
function isStale(refreshedAt, staleAfterSeconds, currentTime) {
	return currentTime - new Date(refreshedAt).getTime() > staleAfterSeconds * 1e3;
}
function locationErrorMessage(code) {
	if (code === GeolocationPositionError.PERMISSION_DENIED) return "Location permission was denied. Enable it in your browser before sharing.";
	if (code === GeolocationPositionError.TIMEOUT) return "The browser could not determine a location in time. Try again in an open area.";
	return "Your current location is unavailable. Check device location services and try again.";
}
//#endregion
export { Workspace as default };

//# sourceMappingURL=workspace-DzXi5CMo.js.map