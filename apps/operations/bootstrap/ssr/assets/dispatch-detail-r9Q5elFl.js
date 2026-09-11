import { n as DataPair, o as Panel, r as EmptyState, t as Button, u as cn } from "./ui-CuoqGbiO.js";
import { t as CanonicalStatusBadge } from "./canonical-status-badge-D9JpJjoH.js";
import { Head, Link, router, useForm, usePage } from "@inertiajs/react";
import { AlertTriangle, ArrowLeft, CalendarDays, Check, CheckCircle2, Circle, ClipboardList, Clock3, HardHat, MapPin, Navigation, RefreshCw, ShieldCheck, Truck, UserRound, Wrench, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region resources/js/pages/dispatch-detail.tsx
function DispatchDetail({ job, personnel_candidates: personnelCandidates, asset_candidates: assetCandidates, activation, progression, capabilities }) {
	const { flash, errors } = usePage().props;
	const form = useForm({
		personnel: [],
		assets: []
	});
	const selectedCount = form.data.personnel.length + form.data.assets.length;
	const conflictMessage = errors.resources ?? errors.reassignment ?? errors.approval ?? errors.version ?? form.errors.personnel ?? form.errors.assets ?? null;
	const togglePersonnel = (candidate) => {
		const selected = form.data.personnel.some((assignment) => assignment.user_id === candidate.id);
		form.setData("personnel", selected ? form.data.personnel.filter((assignment) => assignment.user_id !== candidate.id) : [...form.data.personnel, {
			user_id: candidate.id,
			assignment_type: candidate.assignment_type
		}]);
	};
	const toggleAsset = (candidate) => {
		const selected = form.data.assets.some((assignment) => assignment.operational_asset_id === candidate.id);
		form.setData("assets", selected ? form.data.assets.filter((assignment) => assignment.operational_asset_id !== candidate.id) : [...form.data.assets, {
			operational_asset_id: candidate.id,
			assignment_type: candidate.assignment_type
		}]);
	};
	const submit = (event) => {
		event.preventDefault();
		form.post(`/operations/dispatch-jobs/${job.id}/assignments`, {
			preserveScroll: true,
			onSuccess: () => form.reset()
		});
	};
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(Head, { title: `${job.reference} ${capabilities.update_own_status ? "assigned job" : "assignment workspace"}` }), /* @__PURE__ */ jsxs("div", {
		className: "min-h-screen bg-canvas",
		children: [/* @__PURE__ */ jsx("header", {
			className: "border-b border-line bg-surface",
			children: /* @__PURE__ */ jsxs("div", {
				className: "mx-auto max-w-[96rem] px-4 py-4 md:px-6",
				children: [/* @__PURE__ */ jsxs(Link, {
					href: "/",
					className: "inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-ink-soft hover:bg-surface-subtle hover:text-ink",
					children: [/* @__PURE__ */ jsx(ArrowLeft, {
						className: "h-4 w-4",
						"aria-hidden": "true"
					}), capabilities.update_own_status ? "Back to today's work" : "Back to dispatch workspace"]
				}), /* @__PURE__ */ jsxs("div", {
					className: "mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "flex flex-wrap items-center gap-2",
							children: [/* @__PURE__ */ jsx("h1", {
								className: "text-2xl font-semibold tracking-[-0.02em]",
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
						children: [/* @__PURE__ */ jsx(CanonicalStatusBadge, { status: job.priority }), /* @__PURE__ */ jsxs("span", {
							className: "inline-flex min-h-6 items-center rounded-full bg-surface-subtle px-2.5 py-0.5 text-xs font-medium text-ink-soft",
							children: ["Version ", job.version]
						})]
					})]
				})]
			})
		}), /* @__PURE__ */ jsxs("main", {
			className: "mx-auto max-w-[96rem] space-y-5 px-4 py-5 md:px-6",
			children: [
				flash && /* @__PURE__ */ jsxs("div", {
					className: cn("flex items-start gap-3 rounded-lg border px-4 py-3 text-sm", flash.tone === "success" && "border-success bg-success-soft text-success-strong", flash.tone === "warning" && "border-warning bg-warning-soft text-warning-strong", flash.tone === "error" && "border-danger bg-danger-soft text-danger", flash.tone === "info" && "border-info bg-info-soft text-info-strong"),
					role: "status",
					children: [/* @__PURE__ */ jsx(Check, {
						className: "mt-0.5 h-4 w-4 shrink-0",
						"aria-hidden": "true"
					}), flash.message]
				}),
				conflictMessage && /* @__PURE__ */ jsxs("div", {
					className: "flex items-start gap-3 rounded-lg border border-danger bg-danger-soft px-4 py-3 text-sm text-danger",
					role: "alert",
					children: [/* @__PURE__ */ jsx(AlertTriangle, {
						className: "mt-0.5 h-4 w-4 shrink-0",
						"aria-hidden": "true"
					}), /* @__PURE__ */ jsxs("div", { children: [
						/* @__PURE__ */ jsx("p", {
							className: "font-semibold",
							children: "Assignment could not be saved"
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mt-1",
							children: conflictMessage
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mt-1 text-xs",
							children: "Eligibility was rechecked against the current schedule. Review the resource state below and try again."
						})
					] })]
				}),
				capabilities.update_own_status && progression !== null ? /* @__PURE__ */ jsx(FieldJobWorkspace, {
					job,
					progression,
					capabilities
				}) : /* @__PURE__ */ jsxs("div", {
					className: "grid gap-5 xl:grid-cols-[minmax(20rem,0.72fr)_minmax(0,1.28fr)]",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "space-y-5",
						children: [
							/* @__PURE__ */ jsx(DispatchContext, { job }),
							/* @__PURE__ */ jsx(CurrentAssignments, {
								job,
								capabilities
							}),
							capabilities.activate && /* @__PURE__ */ jsx(ActivationPanel, {
								job,
								activation
							}, job.version),
							/* @__PURE__ */ jsx(LifecycleControlsPanel, {
								job,
								capabilities
							}, `lifecycle-${job.version}`)
						]
					}), capabilities.view_assignment_candidates ? /* @__PURE__ */ jsxs("form", {
						onSubmit: submit,
						className: "space-y-5",
						noValidate: true,
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
								children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", {
									className: "text-lg font-semibold",
									children: "Resource eligibility"
								}), /* @__PURE__ */ jsx("p", {
									className: "mt-1 max-w-3xl text-sm leading-6 text-ink-soft",
									children: "Availability, credential validity, asset readiness, maintenance, and overlapping schedules are computed by the server for this dispatch window."
								})] }), capabilities.assign_resources && /* @__PURE__ */ jsxs("div", {
									className: "flex shrink-0 flex-col items-stretch gap-1 sm:items-end",
									children: [/* @__PURE__ */ jsx(Button, {
										type: "submit",
										variant: "primary",
										disabled: form.processing || selectedCount === 0,
										children: form.processing ? "Assigning resources…" : selectedCount > 0 ? `Assign ${selectedCount} resource${selectedCount === 1 ? "" : "s"}` : "Assign resources"
									}), selectedCount === 0 && !form.processing && /* @__PURE__ */ jsx("span", {
										className: "text-xs text-ink-soft",
										children: "Select at least one eligible resource."
									})]
								})]
							}),
							/* @__PURE__ */ jsx(PersonnelCandidates, {
								candidates: personnelCandidates,
								selectedIds: form.data.personnel.map((assignment) => assignment.user_id),
								canAssign: capabilities.assign_resources,
								onToggle: togglePersonnel
							}),
							/* @__PURE__ */ jsx(AssetCandidates, {
								candidates: assetCandidates,
								selectedIds: form.data.assets.map((assignment) => assignment.operational_asset_id),
								canAssign: capabilities.assign_resources,
								onToggle: toggleAsset
							})
						]
					}) : /* @__PURE__ */ jsx(Panel, { children: /* @__PURE__ */ jsx(EmptyState, {
						icon: ShieldCheck,
						title: "Assignment pool is restricted",
						message: "Your role can review resources already assigned to this dispatch, but it cannot discover other personnel, credentials, or asset availability."
					}) })]
				})
			]
		})]
	})] });
}
function FieldJobWorkspace({ job, progression, capabilities }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)]",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "space-y-5",
			children: [/* @__PURE__ */ jsx(FieldProgressionPanel, {
				job,
				progression
			}), /* @__PURE__ */ jsx(RequirementsPanel, { requirements: job.requirements })]
		}), /* @__PURE__ */ jsxs("div", {
			className: "space-y-5",
			children: [/* @__PURE__ */ jsx(DispatchContext, { job }), /* @__PURE__ */ jsx(CurrentAssignments, {
				job,
				capabilities
			})]
		})]
	});
}
function FieldProgressionPanel({ job, progression }) {
	const next = progression.next;
	const form = useForm({
		status: next?.status.value ?? progression.current.value,
		version: job.version
	});
	const [confirming, setConfirming] = useState(false);
	const [attempted, setAttempted] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const confirmationHeading = useRef(null);
	const progressionHeading = useRef(null);
	const error = attempted ? form.errors.version ?? form.errors.status ?? null : null;
	const isStale = attempted && form.errors.version !== void 0;
	const isCompleted = progression.current.value === "completed";
	useEffect(() => {
		if (confirming) confirmationHeading.current?.focus();
	}, [confirming]);
	const focusProgression = () => {
		requestAnimationFrame(() => progressionHeading.current?.focus());
	};
	const syncFormFromPage = (page) => {
		const refreshedJob = page.props.job;
		const refreshedProgression = page.props.progression;
		form.setData({
			status: refreshedProgression?.next?.status.value ?? refreshedProgression?.current.value ?? refreshedJob.status.value,
			version: refreshedJob.version
		});
	};
	const advance = () => {
		if (next === null) return;
		form.post(`/operations/dispatch-jobs/${job.id}/status`, {
			preserveScroll: true,
			onStart: () => setAttempted(true),
			onSuccess: (page) => {
				syncFormFromPage(page);
				setAttempted(false);
				setConfirming(false);
				focusProgression();
			}
		});
	};
	const refresh = () => {
		setRefreshing(true);
		router.reload({
			only: [
				"job",
				"progression",
				"capabilities"
			],
			onSuccess: (page) => {
				syncFormFromPage(page);
				form.clearErrors();
				setAttempted(false);
				setConfirming(false);
				focusProgression();
			},
			onFinish: () => setRefreshing(false)
		});
	};
	const cancelConfirmation = () => {
		setConfirming(false);
		requestAnimationFrame(() => {
			const target = error === null ? `field-next-action-${job.id}` : `field-refresh-action-${job.id}`;
			document.getElementById(target)?.focus();
		});
	};
	return /* @__PURE__ */ jsxs(Panel, {
		className: "overflow-hidden",
		"aria-busy": form.processing || refreshing,
		children: [/* @__PURE__ */ jsx("div", {
			className: "border-b border-line px-4 py-4 sm:px-5",
			children: /* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap items-start justify-between gap-3",
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", {
					ref: progressionHeading,
					tabIndex: -1,
					className: "rounded text-lg font-semibold",
					children: "Field progression"
				}), /* @__PURE__ */ jsx("p", {
					className: "mt-1 max-w-2xl text-sm leading-6 text-ink-soft",
					children: progression.message
				})] }), /* @__PURE__ */ jsx(CanonicalStatusBadge, { status: progression.current })]
			})
		}), /* @__PURE__ */ jsxs("div", {
			className: "space-y-5 px-4 py-5 sm:px-5",
			children: [
				/* @__PURE__ */ jsx("ol", {
					className: "grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3",
					"aria-label": "Dispatch field status",
					children: progression.steps.map((step) => /* @__PURE__ */ jsxs("li", {
						className: "flex min-w-0 items-center gap-2",
						"aria-current": step.state === "current" ? "step" : void 0,
						children: [/* @__PURE__ */ jsx("span", {
							className: cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border", step.state === "complete" && "border-success bg-success-soft text-success-strong", step.state === "current" && "border-brand bg-brand text-brand-contrast", step.state === "upcoming" && "border-line-strong bg-surface text-ink-soft"),
							children: step.state === "complete" ? /* @__PURE__ */ jsx(Check, {
								className: "h-4 w-4",
								"aria-hidden": "true"
							}) : step.state === "current" ? /* @__PURE__ */ jsx(Navigation, {
								className: "h-4 w-4",
								"aria-hidden": "true"
							}) : /* @__PURE__ */ jsx(Circle, {
								className: "h-3.5 w-3.5",
								"aria-hidden": "true"
							})
						}), /* @__PURE__ */ jsxs("span", {
							className: "min-w-0 text-sm",
							children: [/* @__PURE__ */ jsx("span", {
								className: "block truncate font-medium",
								children: step.status.label
							}), /* @__PURE__ */ jsx("span", {
								className: "block text-xs text-ink-soft",
								children: step.state === "complete" ? "Done" : step.state === "current" ? "Current" : "Later"
							})]
						})]
					}, step.status.value))
				}),
				error && /* @__PURE__ */ jsxs("div", {
					className: "rounded-lg border border-danger bg-danger-soft p-4 text-sm text-danger",
					role: "alert",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "flex items-start gap-2",
						children: [/* @__PURE__ */ jsx(AlertTriangle, {
							className: "mt-0.5 h-4 w-4 shrink-0",
							"aria-hidden": "true"
						}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
							className: "font-semibold",
							children: isStale ? "Job changed - refresh before continuing" : "Status was not updated"
						}), /* @__PURE__ */ jsx("p", {
							className: "mt-1 leading-5",
							children: error
						})] })]
					}), /* @__PURE__ */ jsxs(Button, {
						id: `field-refresh-action-${job.id}`,
						className: "mt-3",
						variant: "secondary",
						onClick: refresh,
						disabled: form.processing || refreshing,
						children: [/* @__PURE__ */ jsx(RefreshCw, {
							className: cn("h-4 w-4", refreshing && "animate-spin"),
							"aria-hidden": "true"
						}), refreshing ? "Refreshing job..." : isStale ? "Refresh and review" : "Review current job"]
					})]
				}),
				next === null ? /* @__PURE__ */ jsxs("div", {
					className: cn("flex items-start gap-3 rounded-lg p-4", isCompleted ? "bg-success-soft text-success-strong" : "bg-surface-subtle text-ink"),
					children: [isCompleted ? /* @__PURE__ */ jsx(CheckCircle2, {
						className: "mt-0.5 h-5 w-5 shrink-0",
						"aria-hidden": "true"
					}) : /* @__PURE__ */ jsx(Clock3, {
						className: "mt-0.5 h-5 w-5 shrink-0 text-ink-soft",
						"aria-hidden": "true"
					}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
						className: "font-semibold",
						children: isCompleted ? "Field progression complete" : "No field action available"
					}), /* @__PURE__ */ jsx("p", {
						className: "mt-1 text-sm leading-5",
						children: progression.message
					})] })]
				}) : confirming ? /* @__PURE__ */ jsxs("div", {
					className: "rounded-xl border border-line-strong bg-surface-subtle p-4",
					role: "group",
					"aria-labelledby": "field-confirmation-title",
					children: [
						/* @__PURE__ */ jsx("h3", {
							ref: confirmationHeading,
							id: "field-confirmation-title",
							tabIndex: -1,
							className: "rounded font-semibold",
							children: next.confirmation_title
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mt-2 text-sm leading-6 text-ink-soft",
							children: next.confirmation_message
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
							children: [/* @__PURE__ */ jsx(Button, {
								variant: "quiet",
								onClick: cancelConfirmation,
								disabled: form.processing,
								children: "Keep current status"
							}), /* @__PURE__ */ jsx(Button, {
								variant: "primary",
								onClick: advance,
								disabled: form.processing || refreshing || error !== null,
								children: form.processing ? `Updating to ${next.status.label}...` : `Confirm ${next.status.label}`
							})]
						})
					]
				}) : /* @__PURE__ */ jsxs("div", {
					className: "mobile-safe-bottom border-t border-line pt-4",
					children: [/* @__PURE__ */ jsxs("p", {
						className: "mb-3 text-sm text-ink-soft",
						children: [
							"Next valid step:",
							" ",
							/* @__PURE__ */ jsx("span", {
								className: "font-semibold text-ink",
								children: next.status.label
							})
						]
					}), /* @__PURE__ */ jsx(Button, {
						id: `field-next-action-${job.id}`,
						className: "w-full sm:w-auto",
						variant: "primary",
						onClick: () => setConfirming(true),
						disabled: form.processing || refreshing || error !== null,
						children: next.action_label
					})]
				})
			]
		})]
	});
}
function RequirementsPanel({ requirements }) {
	return /* @__PURE__ */ jsxs(Panel, {
		className: "overflow-hidden",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "border-b border-line px-4 py-3 sm:px-5",
			children: [/* @__PURE__ */ jsx("h2", {
				className: "font-semibold",
				children: "Job requirements"
			}), /* @__PURE__ */ jsx("p", {
				className: "mt-0.5 text-xs text-ink-soft",
				children: "Review before leaving for the site."
			})]
		}), requirements.length === 0 ? /* @__PURE__ */ jsx(EmptyState, {
			compact: true,
			icon: ClipboardList,
			title: "No additional requirements",
			message: "Follow the site note and your standard safety procedure."
		}) : /* @__PURE__ */ jsx("ul", {
			className: "divide-y divide-line",
			children: requirements.map((requirement) => /* @__PURE__ */ jsxs("li", {
				className: "flex items-start gap-3 px-4 py-3 text-sm sm:px-5",
				children: [/* @__PURE__ */ jsx(Check, {
					className: "mt-0.5 h-4 w-4 shrink-0 text-success-strong",
					"aria-hidden": "true"
				}), /* @__PURE__ */ jsx("span", {
					className: "min-w-0 break-words",
					children: requirement
				})]
			}, requirement))
		})]
	});
}
function ActivationPanel({ job, activation }) {
	const form = useForm({ version: job.version });
	const { errors } = usePage().props;
	const [attempted, setAttempted] = useState(false);
	const error = attempted ? errors.version ?? errors.approval ?? errors.status ?? errors.personnel ?? errors.assets ?? null : null;
	const isStale = attempted && errors.version !== void 0;
	const activate = () => {
		form.post(`/operations/dispatch-jobs/${job.id}/activate`, {
			preserveScroll: true,
			onStart: () => setAttempted(true)
		});
	};
	const refresh = () => {
		setAttempted(false);
		form.clearErrors();
		router.reload({ only: [
			"job",
			"activation",
			"capabilities"
		] });
	};
	return /* @__PURE__ */ jsxs(Panel, {
		className: "overflow-hidden",
		children: [/* @__PURE__ */ jsx("div", {
			className: "border-b border-line px-4 py-3",
			children: /* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap items-start justify-between gap-3",
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", {
					className: "font-semibold",
					children: "Dispatch activation"
				}), /* @__PURE__ */ jsxs("p", {
					className: "mt-0.5 text-xs text-ink-soft",
					children: [
						"Version ",
						job.version,
						" will be rechecked with current approval and asset safety."
					]
				})] }), /* @__PURE__ */ jsx("span", {
					className: cn("rounded-full px-2.5 py-1 text-xs font-medium", activation.ready ? "bg-success-soft text-success-strong" : "bg-warning-soft text-warning-strong"),
					children: activation.ready ? "Ready" : "Review needed"
				})]
			})
		}), /* @__PURE__ */ jsxs("div", {
			className: "space-y-4 px-4 py-4",
			children: [
				activation.approval_required && /* @__PURE__ */ jsxs("div", {
					className: "rounded-lg bg-surface-subtle p-3 text-sm",
					children: [/* @__PURE__ */ jsx("p", {
						className: "font-medium",
						children: "Independent approval"
					}), /* @__PURE__ */ jsx("p", {
						className: "mt-1 text-ink-soft",
						children: activation.approval_status === "approved" ? "The latest exceptional request is approved." : activation.approval_status === "rejected" ? "The latest exceptional request was rejected." : "An Operations Manager decision is pending."
					})]
				}),
				activation.blockers.length > 0 && /* @__PURE__ */ jsx("ul", {
					className: "space-y-2 text-sm text-warning-strong",
					children: activation.blockers.map((blocker) => /* @__PURE__ */ jsxs("li", {
						className: "flex items-start gap-2",
						children: [/* @__PURE__ */ jsx(AlertTriangle, {
							className: "mt-0.5 h-4 w-4 shrink-0",
							"aria-hidden": "true"
						}), blocker]
					}, blocker))
				}),
				error && /* @__PURE__ */ jsxs("div", {
					className: "rounded-lg border border-danger bg-danger-soft p-3 text-sm text-danger",
					role: "alert",
					children: [
						/* @__PURE__ */ jsx("p", {
							className: "font-semibold",
							children: isStale ? "Dispatch changed — refresh before activating" : "Activation was blocked"
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mt-1",
							children: error
						}),
						isStale && /* @__PURE__ */ jsxs(Button, {
							className: "mt-3",
							variant: "secondary",
							size: "sm",
							onClick: refresh,
							children: [/* @__PURE__ */ jsx(RefreshCw, {
								className: "h-4 w-4",
								"aria-hidden": "true"
							}), "Refresh and review"]
						})
					]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between",
					children: [/* @__PURE__ */ jsxs(Button, {
						variant: "quiet",
						size: "sm",
						onClick: refresh,
						disabled: form.processing,
						children: [/* @__PURE__ */ jsx(RefreshCw, {
							className: "h-4 w-4",
							"aria-hidden": "true"
						}), "Refresh readiness"]
					}), /* @__PURE__ */ jsx(Button, {
						variant: "primary",
						onClick: activate,
						disabled: form.processing || !activation.ready,
						children: form.processing ? "Activating dispatch…" : "Activate dispatch"
					})]
				})
			]
		})]
	});
}
function LifecycleControlsPanel({ job, capabilities }) {
	const [cancelling, setCancelling] = useState(false);
	const [reopening, setReopening] = useState(false);
	const [archiving, setArchiving] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const cancelForm = useForm({
		reason: "",
		version: job.version
	});
	const reopenForm = useForm({
		reason: "",
		version: job.version
	});
	const archiveForm = useForm({ reason: "" });
	const cancelErrors = cancelForm.errors;
	const reopenErrors = reopenForm.errors;
	const archiveErrors = archiveForm.errors;
	const cancelError = cancelErrors.version ?? cancelErrors.status ?? null;
	const reopenError = reopenErrors.version ?? reopenErrors.status ?? null;
	const archiveError = archiveErrors.status ?? null;
	const archiveBlocked = [
		"dispatched",
		"accepted",
		"en_route",
		"arrived",
		"working"
	].includes(job.status.value);
	if (!(capabilities.cancel || capabilities.reopen || capabilities.archive)) return null;
	const handleCancel = (e) => {
		e.preventDefault();
		cancelForm.post(`/operations/dispatch-jobs/${job.id}/cancel`, {
			preserveScroll: true,
			onSuccess: () => setCancelling(false)
		});
	};
	const handleReopen = (e) => {
		e.preventDefault();
		reopenForm.post(`/operations/dispatch-jobs/${job.id}/reopen`, {
			preserveScroll: true,
			onSuccess: () => setReopening(false)
		});
	};
	const handleArchive = (e) => {
		e.preventDefault();
		archiveForm.post(`/operations/dispatch-jobs/${job.id}/archive`, {
			preserveScroll: true,
			onSuccess: () => setArchiving(false)
		});
	};
	const refresh = () => {
		setRefreshing(true);
		router.reload({ onFinish: () => setRefreshing(false) });
	};
	return /* @__PURE__ */ jsxs(Panel, {
		className: "overflow-hidden",
		"aria-busy": cancelForm.processing || reopenForm.processing || archiveForm.processing || refreshing,
		children: [/* @__PURE__ */ jsxs("div", {
			className: "border-b border-line px-4 py-3 sm:px-5",
			children: [/* @__PURE__ */ jsx("h2", {
				className: "font-semibold",
				children: "Job lifecycle actions"
			}), /* @__PURE__ */ jsx("p", {
				className: "mt-0.5 text-xs text-ink-soft",
				children: "Administrative lifecycle management (cancellation, reopening, archive)."
			})]
		}), /* @__PURE__ */ jsx("div", {
			className: "space-y-4 px-4 py-4 sm:px-5",
			children: cancelling ? /* @__PURE__ */ jsxs("form", {
				onSubmit: handleCancel,
				className: "space-y-3",
				children: [
					/* @__PURE__ */ jsx("h3", {
						className: "text-sm font-semibold text-danger",
						children: "Cancel dispatch job"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-xs text-ink-soft",
						children: "Cancelling this job will end all active personnel and asset assignments safely."
					}),
					cancelError && /* @__PURE__ */ jsxs("div", {
						className: "rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger",
						role: "alert",
						children: [/* @__PURE__ */ jsx("p", { children: cancelError }), cancelErrors.version && /* @__PURE__ */ jsx(Button, {
							type: "button",
							variant: "quiet",
							className: "mt-2 text-danger",
							onClick: refresh,
							disabled: refreshing,
							children: refreshing ? "Refreshing..." : "Refresh current job"
						})]
					}),
					/* @__PURE__ */ jsxs("div", { children: [
						/* @__PURE__ */ jsx("label", {
							htmlFor: "cancel-reason",
							className: "block text-xs font-medium text-ink",
							children: "Cancellation reason (required)"
						}),
						/* @__PURE__ */ jsx("textarea", {
							id: "cancel-reason",
							rows: 3,
							className: "mt-1 block w-full rounded-md border-line text-sm shadow-sm focus:border-danger focus:ring-danger",
							value: cancelForm.data.reason,
							onChange: (e) => cancelForm.setData("reason", e.target.value),
							placeholder: "Explain why this dispatch is being cancelled...",
							required: true,
							"aria-invalid": cancelForm.errors.reason ? "true" : void 0,
							"aria-describedby": cancelForm.errors.reason ? "cancel-reason-error" : void 0
						}),
						cancelForm.errors.reason && /* @__PURE__ */ jsx("p", {
							id: "cancel-reason-error",
							className: "mt-1 text-xs text-danger",
							role: "alert",
							children: cancelForm.errors.reason
						})
					] }),
					/* @__PURE__ */ jsxs("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ jsx(Button, {
							type: "submit",
							variant: "primary",
							className: "bg-danger text-white hover:bg-danger/90",
							disabled: cancelForm.processing || !cancelForm.data.reason.trim(),
							children: cancelForm.processing ? "Cancelling..." : "Confirm cancellation"
						}), /* @__PURE__ */ jsx(Button, {
							type: "button",
							variant: "quiet",
							onClick: () => setCancelling(false),
							disabled: cancelForm.processing,
							children: "Dismiss"
						})]
					})
				]
			}) : reopening ? /* @__PURE__ */ jsxs("form", {
				onSubmit: handleReopen,
				className: "space-y-3",
				children: [
					/* @__PURE__ */ jsx("h3", {
						className: "text-sm font-semibold",
						children: "Reopen dispatch job"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-xs text-ink-soft",
						children: "Reopening will return this job to draft status so resources can be re-assigned and re-activated."
					}),
					reopenError && /* @__PURE__ */ jsxs("div", {
						className: "rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger",
						role: "alert",
						children: [/* @__PURE__ */ jsx("p", { children: reopenError }), reopenErrors.version && /* @__PURE__ */ jsx(Button, {
							type: "button",
							variant: "quiet",
							className: "mt-2 text-danger",
							onClick: refresh,
							disabled: refreshing,
							children: refreshing ? "Refreshing..." : "Refresh current job"
						})]
					}),
					/* @__PURE__ */ jsxs("div", { children: [
						/* @__PURE__ */ jsx("label", {
							htmlFor: "reopen-reason",
							className: "block text-xs font-medium text-ink",
							children: "Reopen reason (optional)"
						}),
						/* @__PURE__ */ jsx("textarea", {
							id: "reopen-reason",
							rows: 2,
							className: "mt-1 block w-full rounded-md border-line text-sm shadow-sm",
							value: reopenForm.data.reason,
							onChange: (e) => reopenForm.setData("reason", e.target.value),
							placeholder: "Reason for reopening cancelled dispatch...",
							"aria-invalid": reopenForm.errors.reason ? "true" : void 0,
							"aria-describedby": reopenForm.errors.reason ? "reopen-reason-error" : void 0
						}),
						reopenForm.errors.reason && /* @__PURE__ */ jsx("p", {
							id: "reopen-reason-error",
							className: "mt-1 text-xs text-danger",
							role: "alert",
							children: reopenForm.errors.reason
						})
					] }),
					/* @__PURE__ */ jsxs("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ jsx(Button, {
							type: "submit",
							variant: "primary",
							disabled: reopenForm.processing,
							children: reopenForm.processing ? "Reopening..." : "Confirm reopen to draft"
						}), /* @__PURE__ */ jsx(Button, {
							type: "button",
							variant: "quiet",
							onClick: () => setReopening(false),
							disabled: reopenForm.processing,
							children: "Dismiss"
						})]
					})
				]
			}) : archiving ? /* @__PURE__ */ jsxs("form", {
				onSubmit: handleArchive,
				className: "space-y-3",
				children: [
					/* @__PURE__ */ jsx("h3", {
						className: "text-sm font-semibold text-danger",
						children: "Archive dispatch job"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-xs text-ink-soft",
						children: "Archiving soft-deletes this job and removes it from normal operational views."
					}),
					archiveError && /* @__PURE__ */ jsx("div", {
						className: "rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger",
						role: "alert",
						children: archiveError
					}),
					/* @__PURE__ */ jsxs("div", { children: [
						/* @__PURE__ */ jsx("label", {
							htmlFor: "archive-reason",
							className: "block text-xs font-medium text-ink",
							children: "Archive reason (optional)"
						}),
						/* @__PURE__ */ jsx("textarea", {
							id: "archive-reason",
							rows: 2,
							className: "mt-1 block w-full rounded-md border-line text-sm shadow-sm",
							value: archiveForm.data.reason,
							onChange: (e) => archiveForm.setData("reason", e.target.value),
							placeholder: "Reason for archiving this dispatch...",
							"aria-invalid": archiveErrors.reason ? "true" : void 0,
							"aria-describedby": archiveErrors.reason ? "archive-reason-error" : void 0
						}),
						archiveErrors.reason && /* @__PURE__ */ jsx("p", {
							id: "archive-reason-error",
							className: "mt-1 text-xs text-danger",
							role: "alert",
							children: archiveForm.errors.reason
						})
					] }),
					/* @__PURE__ */ jsxs("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ jsx(Button, {
							type: "submit",
							variant: "primary",
							className: "bg-danger text-white hover:bg-danger/90",
							disabled: archiveForm.processing,
							children: archiveForm.processing ? "Archiving..." : "Confirm archive"
						}), /* @__PURE__ */ jsx(Button, {
							type: "button",
							variant: "quiet",
							onClick: () => setArchiving(false),
							disabled: archiveForm.processing,
							children: "Dismiss"
						})]
					})
				]
			}) : /* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap gap-2",
				children: [
					capabilities.cancel && job.status.value !== "completed" && job.status.value !== "cancelled" && /* @__PURE__ */ jsx(Button, {
						type: "button",
						variant: "secondary",
						className: "border-danger/30 text-danger hover:bg-danger-soft",
						onClick: () => setCancelling(true),
						children: "Cancel dispatch"
					}),
					capabilities.reopen && job.status.value === "cancelled" && /* @__PURE__ */ jsx(Button, {
						type: "button",
						variant: "secondary",
						onClick: () => setReopening(true),
						children: "Reopen job as draft"
					}),
					capabilities.archive && !archiveBlocked && /* @__PURE__ */ jsx(Button, {
						type: "button",
						variant: "quiet",
						className: "text-ink-soft hover:text-danger",
						onClick: () => setArchiving(true),
						children: "Archive job"
					}),
					capabilities.archive && archiveBlocked && /* @__PURE__ */ jsx("p", {
						className: "self-center text-xs text-ink-soft",
						children: "Archive is unavailable while field work is active. Cancel or complete the dispatch first."
					})
				]
			})
		})]
	});
}
function DispatchContext({ job }) {
	return /* @__PURE__ */ jsxs(Panel, {
		className: "p-4",
		children: [
			/* @__PURE__ */ jsx("h2", {
				className: "font-semibold",
				children: "Dispatch context"
			}),
			/* @__PURE__ */ jsxs("dl", {
				className: "mt-3 divide-y divide-line",
				children: [
					/* @__PURE__ */ jsx(DataPair, {
						label: "Schedule",
						value: /* @__PURE__ */ jsxs("span", {
							className: "inline-flex items-start gap-2",
							children: [
								/* @__PURE__ */ jsx(CalendarDays, {
									className: "mt-0.5 h-4 w-4 shrink-0 text-ink-soft",
									"aria-hidden": "true"
								}),
								formatDateTime(job.scheduled_start),
								" –",
								" ",
								formatDateTime(job.scheduled_end)
							]
						})
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
						value: formatDateTime(job.updated_at)
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
	});
}
function CurrentAssignments({ job, capabilities }) {
	const { auth, errors } = usePage().props;
	const authUser = auth?.user;
	const responseError = errors.response ?? errors.version;
	const assignmentCount = job.personnel_assignments.length + job.asset_assignments.length;
	const [rejectingId, setRejectingId] = useState(null);
	const [reason, setReason] = useState("");
	const [reasonError, setReasonError] = useState(null);
	const [submittingId, setSubmittingId] = useState(null);
	const handleAccept = (assignmentId) => {
		setSubmittingId(assignmentId);
		router.post(`/operations/dispatch-jobs/${job.id}/assignments/${assignmentId}/response`, {
			response: "accepted",
			version: job.version
		}, {
			preserveScroll: true,
			onFinish: () => setSubmittingId(null)
		});
	};
	const handleRejectSubmit = (e, assignmentId) => {
		e.preventDefault();
		if (!reason.trim()) {
			setReasonError("A reason is required when rejecting an assignment.");
			return;
		}
		setReasonError(null);
		setSubmittingId(assignmentId);
		router.post(`/operations/dispatch-jobs/${job.id}/assignments/${assignmentId}/response`, {
			response: "rejected",
			reason: reason.trim(),
			version: job.version
		}, {
			preserveScroll: true,
			onSuccess: () => {
				setRejectingId(null);
				setReason("");
			},
			onError: (errs) => {
				if (errs.reason) setReasonError(errs.reason);
			},
			onFinish: () => setSubmittingId(null)
		});
	};
	const handleEndPersonnel = (assignmentId) => {
		if (!window.confirm("End this active personnel assignment? The assignment history will be preserved.")) return;
		setSubmittingId(assignmentId);
		router.post(`/operations/dispatch-jobs/${job.id}/reassign`, {
			end_personnel_assignment_ids: [assignmentId],
			version: job.version
		}, {
			preserveScroll: true,
			onFinish: () => setSubmittingId(null)
		});
	};
	const handleEndAsset = (assignmentId) => {
		if (!window.confirm("End this active asset assignment? The assignment history will be preserved.")) return;
		setSubmittingId(assignmentId);
		router.post(`/operations/dispatch-jobs/${job.id}/reassign`, {
			end_asset_assignment_ids: [assignmentId],
			version: job.version
		}, {
			preserveScroll: true,
			onFinish: () => setSubmittingId(null)
		});
	};
	return /* @__PURE__ */ jsxs(Panel, {
		className: "overflow-hidden",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "border-b border-line px-4 py-3",
			children: [/* @__PURE__ */ jsx("h2", {
				className: "font-semibold",
				children: "Current assignments"
			}), /* @__PURE__ */ jsxs("p", {
				className: "mt-0.5 text-xs text-ink-soft",
				children: [
					assignmentCount,
					" active resource",
					assignmentCount === 1 ? "" : "s"
				]
			})]
		}), assignmentCount === 0 ? /* @__PURE__ */ jsx(EmptyState, {
			compact: true,
			icon: ClipboardList,
			title: "No resources assigned",
			message: "Eligible selections confirmed below will appear here."
		}) : /* @__PURE__ */ jsxs("ul", {
			className: "divide-y divide-line",
			children: [job.personnel_assignments.map((assignment) => {
				const isUserAssignment = authUser?.id === assignment.user_id;
				const canRespond = assignment.response_status.value === "pending" && isUserAssignment && capabilities?.respond_assignment === true;
				const isRejectingThis = rejectingId === assignment.id;
				const isSubmittingThis = submittingId === assignment.id;
				return /* @__PURE__ */ jsxs("li", {
					className: "space-y-3 px-4 py-3",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "flex items-start gap-3",
							children: [
								/* @__PURE__ */ jsx(ResourceIcon, { icon: "personnel" }),
								/* @__PURE__ */ jsxs("div", {
									className: "min-w-0 flex-1",
									children: [
										/* @__PURE__ */ jsx("p", {
											className: "truncate text-sm font-medium",
											children: assignment.name
										}),
										/* @__PURE__ */ jsxs("p", {
											className: "mt-0.5 text-xs text-ink-soft",
											children: [
												humanize(assignment.type),
												" ·",
												" ",
												/* @__PURE__ */ jsx("span", {
													className: cn(assignment.response_status.value === "accepted" && "font-medium text-success-strong", assignment.response_status.value === "rejected" && "font-medium text-danger", assignment.response_status.value === "pending" && "text-ink-soft"),
													children: assignment.response_status.label
												})
											]
										}),
										assignment.response_reason && /* @__PURE__ */ jsxs("p", {
											className: "mt-1 text-xs text-ink-soft italic",
											children: [
												"Reason:",
												" ",
												assignment.response_reason
											]
										})
									]
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "flex shrink-0 items-center gap-2",
									children: [canRespond && !isRejectingThis && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs(Button, {
										size: "md",
										variant: "secondary",
										disabled: isSubmittingThis,
										"aria-busy": isSubmittingThis,
										onClick: () => handleAccept(assignment.id),
										children: [/* @__PURE__ */ jsx(Check, { className: "h-3.5 w-3.5 text-success-strong" }), isSubmittingThis ? "Accepting…" : "Accept"]
									}), /* @__PURE__ */ jsxs(Button, {
										size: "md",
										variant: "quiet",
										disabled: isSubmittingThis,
										onClick: () => {
											setRejectingId(assignment.id);
											setReason("");
											setReasonError(null);
										},
										children: [/* @__PURE__ */ jsx(X, { className: "h-3.5 w-3.5 text-danger" }), "Reject"]
									})] }), capabilities?.reassign_resources && !isRejectingThis && /* @__PURE__ */ jsxs(Button, {
										size: "sm",
										variant: "quiet",
										disabled: isSubmittingThis,
										"aria-busy": isSubmittingThis,
										onClick: () => handleEndPersonnel(assignment.id),
										children: [/* @__PURE__ */ jsx(X, { className: "h-3.5 w-3.5 text-danger" }), isSubmittingThis ? "Ending…" : "End assignment"]
									})]
								})
							]
						}),
						responseError && isUserAssignment && !isRejectingThis && /* @__PURE__ */ jsx("p", {
							className: "mt-2 text-xs text-danger",
							role: "alert",
							children: responseError
						}),
						isRejectingThis && /* @__PURE__ */ jsxs("form", {
							onSubmit: (e) => handleRejectSubmit(e, assignment.id),
							className: "space-y-3 rounded-lg border border-line bg-surface-subtle p-3",
							children: [/* @__PURE__ */ jsxs("div", { children: [
								/* @__PURE__ */ jsx("label", {
									htmlFor: `rejection-reason-${assignment.id}`,
									className: "block text-xs font-semibold text-ink",
									children: "Rejection reason (required)"
								}),
								/* @__PURE__ */ jsx("p", {
									id: `rejection-reason-${assignment.id}-description`,
									className: "mt-0.5 text-xs text-ink-soft",
									children: "Explain why you are rejecting this assignment. Rejection will close your active interval."
								}),
								/* @__PURE__ */ jsx("textarea", {
									id: `rejection-reason-${assignment.id}`,
									rows: 2,
									value: reason,
									onChange: (e) => {
										setReason(e.target.value);
										setReasonError(null);
									},
									className: "mt-2 block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none",
									placeholder: "Provide reason for rejection...",
									"aria-describedby": `rejection-reason-${assignment.id}-description${reasonError || errors.reason ? ` rejection-reason-${assignment.id}-error` : ""}${responseError ? ` assignment-response-${assignment.id}-error` : ""}`,
									"aria-invalid": reasonError || errors.reason || responseError ? "true" : "false",
									required: true
								}),
								(reasonError || errors.reason) && /* @__PURE__ */ jsx("p", {
									id: `rejection-reason-${assignment.id}-error`,
									className: "mt-1 text-xs text-danger",
									role: "alert",
									children: reasonError || errors.reason
								}),
								responseError && isUserAssignment && /* @__PURE__ */ jsx("p", {
									id: `assignment-response-${assignment.id}-error`,
									className: "mt-1 text-xs text-danger",
									role: "alert",
									children: responseError
								})
							] }), /* @__PURE__ */ jsxs("div", {
								className: "flex items-center justify-end gap-2",
								children: [/* @__PURE__ */ jsx(Button, {
									type: "button",
									size: "md",
									variant: "quiet",
									disabled: isSubmittingThis,
									onClick: () => {
										setRejectingId(null);
										setReason("");
										setReasonError(null);
									},
									children: "Cancel"
								}), /* @__PURE__ */ jsx(Button, {
									type: "submit",
									size: "md",
									variant: "danger",
									disabled: isSubmittingThis || !reason.trim(),
									"aria-busy": isSubmittingThis,
									children: isSubmittingThis ? "Rejecting…" : "Confirm rejection"
								})]
							})]
						})
					]
				}, `personnel-${assignment.id}`);
			}), job.asset_assignments.map((assignment) => /* @__PURE__ */ jsxs("li", {
				className: "flex items-start gap-3 px-4 py-3",
				children: [
					/* @__PURE__ */ jsx(ResourceIcon, { icon: "asset" }),
					/* @__PURE__ */ jsxs("div", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ jsxs("p", {
							className: "truncate text-sm font-medium",
							children: [
								assignment.code,
								" · ",
								assignment.name
							]
						}), /* @__PURE__ */ jsx("p", {
							className: "mt-0.5 text-xs text-ink-soft",
							children: humanize(assignment.type)
						})]
					}),
					capabilities?.reassign_resources && /* @__PURE__ */ jsxs(Button, {
						size: "sm",
						variant: "quiet",
						disabled: submittingId === assignment.id,
						"aria-busy": submittingId === assignment.id,
						onClick: () => handleEndAsset(assignment.id),
						children: [/* @__PURE__ */ jsx(X, { className: "h-3.5 w-3.5 text-danger" }), submittingId === assignment.id ? "Ending…" : "End assignment"]
					})
				]
			}, `asset-${assignment.id}`))]
		})]
	});
}
function PersonnelCandidates({ candidates, selectedIds, canAssign, onToggle }) {
	return /* @__PURE__ */ jsx("div", {
		className: "grid gap-4 2xl:grid-cols-3",
		children: [
			{
				type: "driver",
				label: "Drivers"
			},
			{
				type: "crane_operator",
				label: "Crane operators"
			},
			{
				type: "field_technician",
				label: "Field technicians"
			}
		].map((group) => {
			const resources = candidates.filter((candidate) => candidate.assignment_type === group.type);
			return /* @__PURE__ */ jsxs("fieldset", {
				className: "min-w-0 rounded-xl border border-line bg-surface",
				children: [
					/* @__PURE__ */ jsx("legend", {
						className: "sr-only",
						children: group.label
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "border-b border-line px-4 py-3",
						children: [/* @__PURE__ */ jsx("h3", {
							className: "font-semibold",
							children: group.label
						}), /* @__PURE__ */ jsxs("p", {
							className: "mt-0.5 text-xs text-ink-soft",
							children: [
								resources.filter((resource) => resource.eligible).length,
								" ",
								"eligible of ",
								resources.length
							]
						})]
					}),
					resources.length === 0 ? /* @__PURE__ */ jsx(EmptyState, {
						compact: true,
						icon: UserRound,
						title: `No ${group.label.toLowerCase()}`,
						message: "Qualified personnel will appear after their operational role is provisioned."
					}) : /* @__PURE__ */ jsx("ul", {
						className: "divide-y divide-line",
						children: resources.map((candidate) => /* @__PURE__ */ jsx(PersonnelCandidate, {
							candidate,
							selected: selectedIds.includes(candidate.id),
							canAssign,
							onToggle
						}, candidate.id))
					})
				]
			}, group.type);
		})
	});
}
function PersonnelCandidate({ candidate, selected, canAssign, onToggle }) {
	const detailsId = `personnel-${candidate.id}-details`;
	return /* @__PURE__ */ jsx("li", {
		className: cn("p-4", selected && "bg-brand-soft", !candidate.eligible && "bg-surface-subtle/60"),
		children: /* @__PURE__ */ jsxs("div", {
			className: "flex min-h-11 items-start gap-1",
			children: [canAssign && /* @__PURE__ */ jsxs("label", {
				className: "flex min-h-11 min-w-11 shrink-0 items-start justify-center pt-1",
				children: [/* @__PURE__ */ jsx("input", {
					type: "checkbox",
					checked: selected,
					disabled: !candidate.eligible,
					onChange: () => onToggle(candidate),
					"aria-describedby": detailsId,
					className: "h-5 w-5 accent-[var(--color-brand)]"
				}), /* @__PURE__ */ jsxs("span", {
					className: "sr-only",
					children: [
						"Select ",
						candidate.name,
						" as",
						" ",
						candidate.assignment_label
					]
				})]
			}), /* @__PURE__ */ jsxs("div", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex flex-wrap items-start justify-between gap-2",
					children: [/* @__PURE__ */ jsx("p", {
						className: "font-medium",
						children: candidate.name
					}), /* @__PURE__ */ jsx(EligibilityBadge, { eligible: candidate.eligible })]
				}), /* @__PURE__ */ jsxs("div", {
					id: detailsId,
					className: "mt-2 space-y-1 text-xs leading-5 text-ink-soft",
					children: [
						/* @__PURE__ */ jsxs("p", { children: [
							"Availability: ",
							candidate.availability.label,
							" · Account: ",
							candidate.account_status.label
						] }),
						/* @__PURE__ */ jsx("p", { children: credentialSummary(candidate) }),
						/* @__PURE__ */ jsx(ConflictDetails, {
							reasons: candidate.reasons,
							conflicts: candidate.schedule_conflicts
						})
					]
				})]
			})]
		})
	});
}
function AssetCandidates({ candidates, selectedIds, canAssign, onToggle }) {
	return /* @__PURE__ */ jsx("div", {
		className: "grid gap-4 2xl:grid-cols-3",
		children: [
			{
				type: "truck",
				label: "Trucks"
			},
			{
				type: "crane",
				label: "Cranes"
			},
			{
				type: "equipment",
				label: "Equipment"
			}
		].map((group) => {
			const resources = candidates.filter((candidate) => candidate.assignment_type === group.type);
			return /* @__PURE__ */ jsxs("fieldset", {
				className: "min-w-0 rounded-xl border border-line bg-surface",
				children: [
					/* @__PURE__ */ jsx("legend", {
						className: "sr-only",
						children: group.label
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "border-b border-line px-4 py-3",
						children: [/* @__PURE__ */ jsx("h3", {
							className: "font-semibold",
							children: group.label
						}), /* @__PURE__ */ jsxs("p", {
							className: "mt-0.5 text-xs text-ink-soft",
							children: [
								resources.filter((resource) => resource.eligible).length,
								" ",
								"eligible of ",
								resources.length
							]
						})]
					}),
					resources.length === 0 ? /* @__PURE__ */ jsx(EmptyState, {
						compact: true,
						icon: Truck,
						title: `No ${group.label.toLowerCase()}`,
						message: "Registered assets in this category will appear here."
					}) : /* @__PURE__ */ jsx("ul", {
						className: "divide-y divide-line",
						children: resources.map((candidate) => /* @__PURE__ */ jsx(AssetCandidate, {
							candidate,
							selected: selectedIds.includes(candidate.id),
							canAssign,
							onToggle
						}, candidate.id))
					})
				]
			}, group.type);
		})
	});
}
function AssetCandidate({ candidate, selected, canAssign, onToggle }) {
	const detailsId = `asset-${candidate.id}-details`;
	return /* @__PURE__ */ jsx("li", {
		className: cn("p-4", selected && "bg-brand-soft", !candidate.eligible && "bg-surface-subtle/60"),
		children: /* @__PURE__ */ jsxs("div", {
			className: "flex min-h-11 items-start gap-1",
			children: [canAssign && /* @__PURE__ */ jsxs("label", {
				className: "flex min-h-11 min-w-11 shrink-0 items-start justify-center pt-1",
				children: [/* @__PURE__ */ jsx("input", {
					type: "checkbox",
					checked: selected,
					disabled: !candidate.eligible,
					onChange: () => onToggle(candidate),
					"aria-describedby": detailsId,
					className: "h-5 w-5 accent-[var(--color-brand)]"
				}), /* @__PURE__ */ jsxs("span", {
					className: "sr-only",
					children: [
						"Select ",
						candidate.code,
						" · ",
						candidate.name
					]
				})]
			}), /* @__PURE__ */ jsxs("div", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex flex-wrap items-start justify-between gap-2",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
						className: "font-medium",
						children: candidate.code
					}), /* @__PURE__ */ jsx("p", {
						className: "mt-0.5 text-xs text-ink-soft",
						children: candidate.name
					})] }), /* @__PURE__ */ jsx(EligibilityBadge, { eligible: candidate.eligible })]
				}), /* @__PURE__ */ jsxs("div", {
					id: detailsId,
					className: "mt-2 space-y-1 text-xs leading-5 text-ink-soft",
					children: [/* @__PURE__ */ jsxs("p", { children: [
						"Readiness: ",
						candidate.readiness.label,
						" · Maintenance blocks: ",
						candidate.blocking_maintenance_count
					] }), /* @__PURE__ */ jsx(ConflictDetails, {
						reasons: candidate.reasons,
						conflicts: candidate.schedule_conflicts
					})]
				})]
			})]
		})
	});
}
function EligibilityBadge({ eligible }) {
	return /* @__PURE__ */ jsxs("span", {
		className: cn("inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", eligible ? "bg-success-soft text-success-strong" : "bg-danger-soft text-danger"),
		children: [eligible ? /* @__PURE__ */ jsx(Check, {
			className: "h-3.5 w-3.5",
			"aria-hidden": "true"
		}) : /* @__PURE__ */ jsx(AlertTriangle, {
			className: "h-3.5 w-3.5",
			"aria-hidden": "true"
		}), eligible ? "Eligible" : "Blocked"]
	});
}
function ConflictDetails({ reasons, conflicts }) {
	if (reasons.length === 0) return /* @__PURE__ */ jsxs("p", {
		className: "inline-flex items-start gap-1.5 text-success-strong",
		children: [/* @__PURE__ */ jsx(ShieldCheck, {
			className: "mt-0.5 h-3.5 w-3.5 shrink-0",
			"aria-hidden": "true"
		}), "No blocking conflict at this schedule."]
	});
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("ul", {
		className: "space-y-1 text-danger",
		children: reasons.map((reason) => /* @__PURE__ */ jsxs("li", {
			className: "flex items-start gap-1.5",
			children: [/* @__PURE__ */ jsx(AlertTriangle, {
				className: "mt-0.5 h-3.5 w-3.5 shrink-0",
				"aria-hidden": "true"
			}), reason]
		}, reason))
	}), conflicts.length > 0 && /* @__PURE__ */ jsxs("p", {
		className: "flex items-start gap-1.5",
		children: [/* @__PURE__ */ jsx(Clock3, {
			className: "mt-0.5 h-3.5 w-3.5 shrink-0",
			"aria-hidden": "true"
		}), conflicts.map((conflict) => `${conflict.reference} (${formatDateTime(conflict.scheduled_start)} – ${formatDateTime(conflict.scheduled_end)})`).join("; ")]
	})] });
}
function ResourceIcon({ icon }) {
	return /* @__PURE__ */ jsx("div", {
		className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-ink-soft",
		children: /* @__PURE__ */ jsx(icon === "personnel" ? HardHat : Wrench, {
			className: "h-4 w-4",
			"aria-hidden": "true"
		})
	});
}
function credentialSummary(candidate) {
	if (candidate.credential.status === "not_required") return "Credential: no additional credential required";
	const expiry = candidate.credential.expires_at ? ` · Expires ${formatDate(candidate.credential.expires_at)}` : "";
	return `Credential: ${candidate.credential.label} · ${humanize(candidate.credential.status)}${expiry}`;
}
function formatDateTime(value) {
	if (value === null) return "Not scheduled";
	return new Intl.DateTimeFormat(void 0, {
		dateStyle: "medium",
		timeStyle: "short"
	}).format(new Date(value));
}
function formatDate(value) {
	return new Intl.DateTimeFormat(void 0, {
		dateStyle: "medium",
		timeZone: "UTC"
	}).format(/* @__PURE__ */ new Date(`${value}T00:00:00Z`));
}
function humanize(value) {
	return value.replaceAll("_", " ");
}
//#endregion
export { DispatchDetail as default };

//# sourceMappingURL=dispatch-detail-r9Q5elFl.js.map