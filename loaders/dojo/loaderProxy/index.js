/*
 * (C) Copyright HCL Technologies Ltd. 2018, 2019
 * (C) Copyright IBM Corp. 2012, 2016 All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const loaderUtils = require("loader-utils");
const {callSyncBail} = require("webpack-plugin-compat");

module.exports = function() {
	const dojoRequire = callSyncBail(this._compiler, "get dojo require");
	const issuerAbsMid = this._module.issuer && this._module.issuer.absMid || this._module.absMid || "";
	function toAbsMid(request) {
		return dojoRequire.toAbsMid(request, {mid:issuerAbsMid});
	}
	this.cacheable && this.cacheable();
	const query = this.query ? loaderUtils.parseQuery(this.query) : {};
	const loader = query.loader;
	if (!loader) {
		throw new Error("No loader specified");
	}
	const name = query.name ||
	             this._module.absMid && this._module.absMid.split("!").pop() ||
							 this._module.request.split("!").pop();
	const pluginOptions = callSyncBail(this._compiler, "dojo-webpack-plugin-options");
	const deps = query.deps ? query.deps.split(",") : [];
	const buf = [];
	const runner = require.resolve(pluginOptions.async ? "./asyncRunner.js" : "./runner.js").replace(/\\/g, "/");
	this._module.addAbsMid(`${toAbsMid(loader)}!${toAbsMid(name)}`);
	buf.push("var runner = require(\"" + runner + "\");");
	buf.push("var loader = require(\"" + loader + "?absMid=" + toAbsMid(loader)  + "\");");
	buf.push(`var req = ${this._compilation.mainTemplate.requireFn}.${pluginOptions.requireFnPropName}.c();`);
	deps.forEach((dep) => {
		dep = decodeURIComponent(dep);
		dep = dep.split("!").map((segment) => {
			return toAbsMid(segment);
		}).join("!");
		buf.push("require(\"" + dep + "?absMid=" + dep.replace(/\!/g, "%21") + "\");");
	});
	if (pluginOptions.async) {
		buf.push(`module.exports = Promise.resolve(runner(loader, "${name}", req)).then(function(m){return module.exports=m});`);
		buf.push('module.exports.__DOJO_WEBPACK_DEFINE_PROMISE__ = true;');
	} else {
		buf.push(`module.exports = runner(loader, "${name}", req);`);
	}

	this._module.filterAbsMids && this._module.filterAbsMids(absMid => {
		return !/loaderProxy/.test(absMid);
	});

	return buf.join("\n");
};
