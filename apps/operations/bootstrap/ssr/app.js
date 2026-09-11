import { createInertiaApp } from "@inertiajs/react";
import createServer from "@inertiajs/react/server";
import { renderToString } from "react-dom/server";
//#region resources/js/app.tsx
var appName = "Laravel";
var render = await createInertiaApp({
	resolve: async (name, page) => {
		const pages = /* #__PURE__ */ Object.assign({
			"./pages/auth/auth-shell.tsx": () => import("./assets/auth-shell-CFgk3SnJ.js"),
			"./pages/auth/forgot-password.tsx": () => import("./assets/forgot-password-DPLe0dnN.js"),
			"./pages/auth/login.tsx": () => import("./assets/login-CfRAoWuv.js"),
			"./pages/auth/reset-password.tsx": () => import("./assets/reset-password-CK06Q_gA.js"),
			"./pages/auth/verify-email.tsx": () => import("./assets/verify-email-C6mOrVW3.js"),
			"./pages/dispatch-detail.tsx": () => import("./assets/dispatch-detail-r9Q5elFl.js"),
			"./pages/operations.tsx": () => import("./assets/operations-CMSpiXtW.js"),
			"./pages/workspace.tsx": () => import("./assets/workspace-DzXi5CMo.js")
		});
		const module = await (pages[`./pages/${name}.tsx`] || pages[`./pages/${name}.jsx`] || pages[`./Pages/${name}.tsx`] || pages[`./Pages/${name}.jsx`])?.();
		if (!module) throw new Error(`Page not found: ${name}`);
		return module.default ?? module;
	},
	title: (title) => title ? `${title} - ${appName}` : appName,
	progress: { color: "#4B5563" }
});
var renderPage = (page) => render(page, renderToString);
createServer(renderPage);
//#endregion
export { renderPage as default };

//# sourceMappingURL=app.js.map