import { t as DevUserSwitcher } from "./dev-user-switcher-CinfgeBK.js";
import { jsx, jsxs } from "react/jsx-runtime";
//#region resources/js/pages/auth/auth-shell.tsx
function AuthShell({ children }) {
	return /* @__PURE__ */ jsxs("main", {
		className: "flex min-h-screen items-center justify-center bg-canvas px-4 py-10",
		children: [/* @__PURE__ */ jsxs("section", {
			className: "w-full max-w-md rounded-2xl border border-line bg-surface p-6 sm:p-8",
			"aria-labelledby": "auth-title",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "mb-7 flex items-center gap-3",
				children: [/* @__PURE__ */ jsx("div", {
					className: "flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-sm font-semibold text-white",
					children: "C2"
				}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
					className: "font-semibold text-ink",
					children: "Core Transaction 2"
				}), /* @__PURE__ */ jsx("p", {
					className: "text-sm text-ink-soft",
					children: "Secure operations access"
				})] })]
			}), children]
		}), /* @__PURE__ */ jsx(DevUserSwitcher, {})]
	});
}
//#endregion
export { AuthShell as t };

//# sourceMappingURL=auth-shell-Cu5-fe_S.js.map