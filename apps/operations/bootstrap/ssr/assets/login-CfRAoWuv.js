import { t as AuthShell } from "./auth-shell-Cu5-fe_S.js";
import { Head, Link, useForm } from "@inertiajs/react";
import { jsx, jsxs } from "react/jsx-runtime";
//#region resources/js/pages/auth/login.tsx
function Login({ status }) {
	const form = useForm({
		email: "",
		password: "",
		remember: false
	});
	const submit = (event) => {
		event.preventDefault();
		form.post("/login", { onFinish: () => form.reset("password") });
	};
	return /* @__PURE__ */ jsxs(AuthShell, { children: [
		/* @__PURE__ */ jsx(Head, { title: "Sign in" }),
		/* @__PURE__ */ jsx("h1", {
			id: "auth-title",
			className: "text-2xl font-semibold tracking-[-0.02em] text-ink",
			children: "Sign in to operations"
		}),
		/* @__PURE__ */ jsx("p", {
			className: "mt-2 text-sm leading-6 text-ink-soft",
			children: "Use your company account. Access is limited to active internal personnel."
		}),
		status && /* @__PURE__ */ jsx("p", {
			role: "status",
			className: "mt-4 rounded-lg bg-success-soft px-3 py-2 text-sm text-green-800",
			children: status
		}),
		/* @__PURE__ */ jsxs("form", {
			onSubmit: submit,
			className: "mt-6 space-y-4",
			children: [
				/* @__PURE__ */ jsxs("label", {
					className: "block text-sm font-medium text-ink",
					children: [
						"Email",
						/* @__PURE__ */ jsx("input", {
							type: "email",
							value: form.data.email,
							onChange: (e) => form.setData("email", e.target.value),
							autoComplete: "email",
							autoFocus: true,
							className: "mt-1 h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink"
						}),
						form.errors.email && /* @__PURE__ */ jsx("span", {
							className: "mt-1 block text-sm text-red-700",
							children: form.errors.email
						})
					]
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "block text-sm font-medium text-ink",
					children: [
						"Password",
						/* @__PURE__ */ jsx("input", {
							type: "password",
							value: form.data.password,
							onChange: (e) => form.setData("password", e.target.value),
							autoComplete: "current-password",
							className: "mt-1 h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink"
						}),
						form.errors.password && /* @__PURE__ */ jsx("span", {
							className: "mt-1 block text-sm text-red-700",
							children: form.errors.password
						})
					]
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "flex min-h-11 items-center gap-2 text-sm text-ink-soft",
					children: [
						/* @__PURE__ */ jsx("input", {
							type: "checkbox",
							checked: form.data.remember,
							onChange: (e) => form.setData("remember", e.target.checked)
						}),
						" ",
						"Keep me signed in on this device"
					]
				}),
				/* @__PURE__ */ jsx("button", {
					type: "submit",
					disabled: form.processing,
					className: "h-11 w-full rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60",
					children: form.processing ? "Signing in…" : "Sign in"
				})
			]
		}),
		/* @__PURE__ */ jsx(Link, {
			href: "/forgot-password",
			className: "mt-5 inline-flex min-h-11 items-center text-sm font-medium text-brand-strong",
			children: "Forgot password?"
		})
	] });
}
//#endregion
export { Login as default };

//# sourceMappingURL=login-CfRAoWuv.js.map