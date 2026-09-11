import { t as AuthShell } from "./auth-shell-Cu5-fe_S.js";
import { Head, useForm } from "@inertiajs/react";
import { jsx, jsxs } from "react/jsx-runtime";
//#region resources/js/pages/auth/reset-password.tsx
function ResetPassword({ email, token }) {
	const form = useForm({
		email,
		token,
		password: "",
		password_confirmation: ""
	});
	return /* @__PURE__ */ jsxs(AuthShell, { children: [
		/* @__PURE__ */ jsx(Head, { title: "Choose password" }),
		/* @__PURE__ */ jsx("h1", {
			id: "auth-title",
			className: "text-2xl font-semibold text-ink",
			children: "Choose a new password"
		}),
		/* @__PURE__ */ jsxs("form", {
			onSubmit: (event) => {
				event.preventDefault();
				form.post("/reset-password", { onFinish: () => form.reset("password", "password_confirmation") });
			},
			className: "mt-6 space-y-4",
			children: [
				/* @__PURE__ */ jsxs("label", {
					className: "block text-sm font-medium text-ink",
					children: ["Email", /* @__PURE__ */ jsx("input", {
						readOnly: true,
						value: form.data.email,
						className: "mt-1 h-11 w-full rounded-lg border border-line bg-surface-subtle px-3"
					})]
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "block text-sm font-medium text-ink",
					children: [
						"New password",
						/* @__PURE__ */ jsx("input", {
							type: "password",
							value: form.data.password,
							onChange: (e) => form.setData("password", e.target.value),
							autoComplete: "new-password",
							className: "mt-1 h-11 w-full rounded-lg border border-line px-3"
						}),
						form.errors.password && /* @__PURE__ */ jsx("span", {
							className: "mt-1 block text-sm text-red-700",
							children: form.errors.password
						})
					]
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "block text-sm font-medium text-ink",
					children: ["Confirm password", /* @__PURE__ */ jsx("input", {
						type: "password",
						value: form.data.password_confirmation,
						onChange: (e) => form.setData("password_confirmation", e.target.value),
						autoComplete: "new-password",
						className: "mt-1 h-11 w-full rounded-lg border border-line px-3"
					})]
				}),
				/* @__PURE__ */ jsx("button", {
					disabled: form.processing,
					className: "h-11 w-full rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60",
					children: "Update password"
				})
			]
		})
	] });
}
//#endregion
export { ResetPassword as default };

//# sourceMappingURL=reset-password-CK06Q_gA.js.map