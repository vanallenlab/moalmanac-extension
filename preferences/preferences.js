/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2011 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

/**
 * Sets or removes the "disabled" attribute on an element.
 */
function toggleDisabled(element, status) {
	if (status) {
		element.setAttribute("disabled", "true");
	} else if (element.hasAttribute("disabled")) {
		element.removeAttribute("disabled");
	}
}

var Zotero_Preferences = {
	pane: {},
	content: {},
	visiblePaneName: null,
	init: async function () {
		Zotero.isPreferences = true;
		Zotero.Messaging.init();

		var panesDiv = document.getElementById("panes");
		var id;
		for (var i in panesDiv.childNodes) {
			var paneDiv = panesDiv.childNodes[i];
			id = paneDiv.id;
			if (id) {
				if (id.substr(0, 5) === "pane-") {
					var paneName = id.substr(5);
					Zotero_Preferences.pane[paneName] = paneDiv;
					Zotero_Preferences.content[paneName] = document.getElementById("content-" + paneName);
					paneDiv.addEventListener("click", Zotero_Preferences.onPaneClick, false);
				}
			}
		}

		let hashPane = window.location.hash && window.location.hash.substr(1);
		if (hashPane in Zotero_Preferences.pane) {
			Zotero_Preferences.selectPane(hashPane);
		} else {
			Zotero_Preferences.selectPane("general");
		}

		Zotero_Preferences.General.init();
		Zotero_Preferences.Advanced.init();

		var checkboxes = document.querySelectorAll('[data-pref]');
		for (let checkbox of checkboxes) {
			checkbox.onchange = Zotero_Preferences.onPrefCheckboxChange;
			checkbox.checked = await Zotero.Prefs.getAsync(checkbox.dataset.pref);
		}

		Zotero.Prefs.loadNamespace('proxies').then(function () {
			Zotero_Preferences.Proxies.init();
		});

		Zotero.initDeferred.resolve();
		Zotero_Preferences.refreshData();
		window.setInterval(() => Zotero_Preferences.refreshData(), 1000);

		// Hide Google Docs for non-beta users
		if (!Zotero.version.includes('beta') && !Zotero.version.includes('999')) {
			document.getElementById('google-docs-pref').style.display = 'none';
		}
	},

	/**
  * Called when a pane is clicked.
  */
	onPaneClick: function (e) {
		Zotero_Preferences.selectPane(e.currentTarget.id.substr(5));
	},

	onPrefCheckboxChange: function (event) {
		Zotero.Prefs.set(event.target.dataset.pref, event.target.checked);
	},

	/**
  * Selects a pane.
  */
	selectPane: function (paneName) {
		if (this.visiblePaneName === paneName) return;

		if (this.visiblePaneName) {
			this.pane[this.visiblePaneName].classList.toggle('selected', false);
			this.content[this.visiblePaneName].classList.toggle('selected', false);
		}

		this.visiblePaneName = paneName;

		this.pane[paneName].classList.toggle('selected', true);
		this.content[paneName].classList.toggle('selected', true);
	},

	/**
  * Refreshes data that may have changed while the options window is open
  */
	refreshData: function () {
		// get errors
		return Zotero.Errors.getErrors().then(function (errors) {
			if (errors.length) {
				document.getElementById('advanced-no-errors').style.display = "none";
				document.getElementById('advanced-have-errors').style.display = "block";
				document.getElementById('advanced-textarea-errors').textContent = errors.join("\n\n");
			}
			// get debug logging info
			return Zotero.Connector_Debug.count();
		}).then(function (count) {
			document.getElementById('advanced-span-lines-logged').textContent = count.toString();
			toggleDisabled(document.getElementById('advanced-button-view-output'), !count);
			toggleDisabled(document.getElementById('advanced-button-clear-output'), !count);
			toggleDisabled(document.getElementById('advanced-button-submit-output'), !count);
		});
	}
};

Zotero_Preferences.General = {
	init: function () {

		if (Zotero.isBrowserExt) {
			let elem = document.getElementById('intercept-and-import');
			elem.style.display = null;
			this.mimeTypeHandlingComponent = React.createElement(Zotero_Preferences.Components.MIMETypeHandling, null);
			ReactDOM.render(this.mimeTypeHandlingComponent, elem.querySelectorAll('.group-content')[0]);
		}

		ReactDOM.render(React.createElement(Zotero_Preferences.Components.ClientStatus, null), document.getElementById("client-status"));
		document.getElementById("general-button-authorize").onclick = document.getElementById("general-button-reauthorize").onclick = Zotero_Preferences.General.authorize;
		document.getElementById("general-button-clear-credentials").onclick = Zotero_Preferences.General.clearCredentials;

		Zotero.API.getUserInfo().then(Zotero_Preferences.General.updateAuthorization);
	},

	/**
  * Updates the "Authorization" group based on a username
  */
	updateAuthorization: function (userInfo) {
		document.getElementById('general-authorization-not-authorized').style.display = userInfo ? 'none' : 'block';
		document.getElementById('general-authorization-authorized').style.display = !userInfo ? 'none' : 'block';
		if (userInfo) {
			document.getElementById('general-span-authorization-username').textContent = userInfo.username;
		}
	},

	/**
  * Authorizes the user
  */
	authorize: function () {
		Zotero.API.authorize().then(function (data) {
			Zotero_Preferences.General.updateAuthorization(data);
		}, function (e) {
			if (e.message.includes('cancelled')) return;
			alert("Authorization could not be completed.\n\n" + e.message);
		});
	},

	/**
  * Clears authorization
  */
	clearCredentials: function () {
		Zotero.API.clearCredentials();
		Zotero_Preferences.General.updateAuthorization(null);
	},

	/**
  * Opens the translator tester in a new window.
  */
	openTranslatorTester: function () {
		if (Zotero.isSafari) {
			window.open(safari.extension.baseURI + "tools/testTranslators/testTranslators.html", "translatorTester");
		} else if (Zotero.isBrowserExt) {
			window.open(browser.extension.getURL("tools/testTranslators/testTranslators.html"), "translatorTester");
		}
	}
};

Zotero_Preferences.Proxies = {
	init: function () {
		this.proxiesComponent = React.createElement(Zotero_Preferences.Components.ProxySettings, null);
		ReactDOM.render(this.proxiesComponent, document.getElementById('content-proxies'));
	}
};

Zotero_Preferences.Advanced = {
	init: function () {

		document.getElementById("advanced-checkbox-enable-logging").onchange = function () {
			Zotero.Debug.setStore(this.checked);
		};
		document.getElementById("advanced-checkbox-enable-at-startup").onchange = function () {
			Zotero.Prefs.set('debug.store', this.checked);
		};
		document.getElementById("advanced-checkbox-show-in-console").onchange = function () {
			Zotero.Prefs.set('debug.log', this.checked);
			Zotero.Debug.bgInit();
			// Zotero.Debug.init() sets store to false
			Zotero.Debug.setStore(document.getElementById("advanced-checkbox-enable-logging").checked);
			Zotero.Prefs.set('debug.store', document.getElementById("advanced-checkbox-enable-at-startup").checked);
		};
		document.getElementById("advanced-checkbox-report-translator-failure").onchange = function () {
			Zotero.Prefs.set('reportTranslationFailure', this.checked);
		};
		document.getElementById("advanced-button-view-output").onclick = Zotero_Preferences.Advanced.viewDebugOutput;
		document.getElementById("advanced-button-clear-output").onclick = Zotero_Preferences.Advanced.clearDebugOutput;
		document.getElementById("advanced-button-submit-output").onclick = Zotero_Preferences.Advanced.submitDebugOutput;
		document.getElementById("advanced-button-update-translators").onclick = function () {
			Zotero.Repo.update(false);
		};
		document.getElementById("advanced-button-reset-translators").onclick = function () {
			Zotero.Repo.update(true);
		};
		document.getElementById("advanced-button-report-errors").onclick = Zotero_Preferences.Advanced.submitErrors;

		var openTranslatorTesterButton = document.getElementById("advanced-button-open-translator-tester");
		if (openTranslatorTesterButton) openTranslatorTesterButton.onclick = Zotero_Preferences.General.openTranslatorTester;
		var testRunnerButton = document.getElementById("advanced-button-open-test-runner");
		if (testRunnerButton) testRunnerButton.onclick = function () {
			if (Zotero.isSafari) {
				Zotero.Connector_Browser.openTab(safari.extension.baseURI + "test/test.html");
			} else {
				Zotero.Connector_Browser.openTab(browser.extension.getURL(`test/test.html`));
			}
		};
		document.getElementById("advanced-button-config-editor").onclick = function () {
			if (confirm("Changing these advanced settings can be harmful to the stability, security, and performance of the browser and the Zotero Connector. \nYou should only proceed if you are sure of what you are doing.")) {
				Zotero.Connector_Browser.openConfigEditor();
			}
		};

		// get preference values
		Zotero.Connector_Debug.storing(function (status) {
			document.getElementById('advanced-checkbox-enable-logging').checked = !!status;
		});
		Zotero.Prefs.getAsync("debug.store").then(function (status) {
			document.getElementById('advanced-checkbox-enable-at-startup').checked = !!status;
		});
		Zotero.Prefs.getAsync("debug.log").then(function (status) {
			document.getElementById('advanced-checkbox-show-in-console').checked = !!status;
		});
		Zotero.Prefs.getAsync("reportTranslationFailure").then(function (status) {
			document.getElementById('advanced-checkbox-report-translator-failure').checked = !!status;
		});
	},

	/**
  * Opens a new window to view debug output.
  */
	viewDebugOutput: function () {
		Zotero.Connector_Debug.get(function (log) {
			var textarea = document.getElementById("advanced-textarea-debug");
			textarea.textContent = log;
			textarea.style.display = "";
		});
	},

	/**
  * Clears stored debug output.
  */
	clearDebugOutput: function () {
		Zotero.Debug.clear();
		Zotero_Preferences.refreshData();
		var textarea = document.getElementById("advanced-textarea-debug");
		textarea.style.display = 'none';
	},

	/**
  * Submits debug output to server.
  */
	submitDebugOutput: async function () {
		var submitOutputButton = document.getElementById('advanced-button-submit-output');
		toggleDisabled(submitOutputButton, true);

		// We have to request within a user gesture in chrome
		if (Zotero.isChrome) {
			try {
				await browser.permissions.request({ permissions: ['management'] });
			} catch (e) {
				Zotero.debug(`Management permission request failed: ${e.message || e}`);
			}
		}

		return Zotero.Connector_Debug.submitReport().then(function (reportID) {
			alert("Your debug output has been submitted.\n\n" + `The Debug ID is D${reportID}.`);
		}, function (e) {
			alert(`An error occurred submitting your debug output.\n\n${e.message}\n\n` + 'Please check your internet connection. If the problem persists, ' + 'please post a message to the Zotero Forums (forums.zotero.org).');
		}).then(() => toggleDisabled(submitOutputButton, false));
	},

	/**
  * Submits an error report
  */
	submitErrors: async function () {
		var reportErrorsButton = document.getElementById('advanced-button-report-errors');
		toggleDisabled(reportErrorsButton, true);

		// We have to request within a user gesture in chrome
		if (Zotero.isChrome) {
			try {
				await browser.permissions.request({ permissions: ['management'] });
			} catch (e) {
				Zotero.debug(`Management permission request failed: ${e.message || e}`);
			}
		}

		try {
			var reportID = await Zotero.Errors.sendErrorReport();
			alert(`Your error report has been submitted.\n\nReport ID: ${reportID}\n\n` + 'Please post a message to the Zotero Forums (forums.zotero.org) with this Report ' + 'ID, a description of the problem, and any steps necessary to reproduce it.\n\n' + 'Error reports are not reviewed unless referred to in the forums.');
		} catch (e) {
			alert(`An error occurred submitting your error report.\n\n${e.message}\n\n` + 'Please check your internet connection. If the problem persists, ' + 'please post a message to the Zotero Forums (forums.zotero.org).');
		} finally {
			toggleDisabled(reportErrorsButton, false);
		}
	}
};

Zotero_Preferences.Components = {};

Zotero_Preferences.Components.ClientStatus = class ClientStatus extends React.Component {
	constructor(props) {
		super(props);
		this.checkStatus();
		this.state = {
			available: false
		};

		this.checkStatus = this.checkStatus.bind(this);
	}

	checkStatus() {
		return Zotero.Connector.checkIsOnline().then(function (status) {
			this.setState({ available: status });
		}.bind(this));
	}

	render() {
		let available = React.createElement(
			"span",
			null,
			"available."
		);
		if (!this.state.available) {
			available = React.createElement(
				"span",
				null,
				"unavailable. If Zotero is open, see the ",
				React.createElement(
					"a",
					{ href: "https://www.zotero.org/support/kb/connector_zotero_unavailable" },
					"troubleshooting page"
				),
				"."
			);
		}
		return React.createElement(
			"div",
			null,
			React.createElement(
				"p",
				null,
				"Zotero is currently ",
				available
			),
			React.createElement(
				"p",
				null,
				React.createElement("input", { type: "button", value: "Update Status", onClick: this.checkStatus })
			)
		);
	}
};

Zotero_Preferences.Components.ProxySettings = class ProxySettings extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			transparent: Zotero.Prefs.get('proxies.transparent')
		};

		this.handleTransparentChange = this.handleTransparentChange.bind(this);
	}

	handleTransparentChange(transparent) {
		this.setState({ transparent });
	}

	render() {
		return React.createElement(
			"div",
			null,
			React.createElement(
				"div",
				{ className: "group" },
				React.createElement(
					"div",
					{ className: "group-title" },
					"Proxy Settings"
				),
				React.createElement(
					"div",
					{ className: "group-content" },
					React.createElement(
						"p",
						null,
						"Zotero will transparently redirect requests through saved proxies. See the ",
						React.createElement(
							"a",
							{ href: "https://www.zotero.org/support/proxies" },
							"proxy documentation"
						),
						" for more information."
					),
					React.createElement("p", null),
					React.createElement(Zotero_Preferences.Components.ProxyPreferences, { onTransparentChange: this.handleTransparentChange })
				)
			),
			React.createElement(
				"div",
				{ className: "group" },
				React.createElement(
					"div",
					{ className: "group-title" },
					"Configured Proxies"
				),
				React.createElement(
					"div",
					{ className: "group-content" },
					React.createElement(Zotero_Preferences.Components.Proxies, { transparent: this.state.transparent })
				)
			)
		);
	}
};

Zotero_Preferences.Components.ProxyPreferences = class ProxyPreferences extends React.Component {
	constructor(props) {
		super(props);
		let state = {};
		let settings = ['transparent', 'autoRecognize', 'showRedirectNotification', 'disableByDomain', 'disableByDomainString'];
		for (let setting of settings) {
			state[setting] = Zotero.Prefs.get('proxies.' + setting);
		}
		this.state = state;

		this.handleCheckboxChange = this.handleCheckboxChange.bind(this);
		this.handleTextInputChange = this.handleTextInputChange.bind(this);
	}

	handleCheckboxChange(event) {
		this.updateState(event.target.name, event.target.checked);
	}

	handleTextInputChange(event) {
		this.updateState(event.target.name, event.target.value);
	}

	updateState(name, value) {
		let newState = {};
		newState[name] = value;
		this.setState(newState);
		Zotero.Prefs.set('proxies.' + name, value);
		// Refresh prefs in the background page
		Zotero.Proxies.loadPrefs();
		if (name === 'transparent') {
			this.props.onTransparentChange(value);
		}
	}

	render() {
		let autoRecognise = '';
		if (Zotero.isBrowserExt) {
			autoRecognise = React.createElement(
				"span",
				null,
				React.createElement(
					"label",
					null,
					React.createElement("input", { type: "checkbox", disabled: !this.state.transparent, onChange: this.handleCheckboxChange, name: "autoRecognize", defaultChecked: this.state.autoRecognize }),
					"\xA0Automatically detect new proxies"
				),
				React.createElement("br", null)
			);
		}
		return React.createElement(
			"div",
			null,
			React.createElement(
				"label",
				null,
				React.createElement("input", { type: "checkbox", name: "transparent", onChange: this.handleCheckboxChange, defaultChecked: this.state.transparent }),
				"\xA0Enable proxy redirection"
			),
			React.createElement("br", null),
			React.createElement(
				"div",
				{ style: { marginLeft: "1em" } },
				React.createElement(
					"label",
					null,
					React.createElement("input", { type: "checkbox", disabled: !this.state.transparent, onChange: this.handleCheckboxChange, name: "showRedirectNotification", defaultChecked: this.state.showRedirectNotification }),
					"\xA0Show a notification when redirecting through a proxy"
				),
				React.createElement("br", null),
				autoRecognise,
				React.createElement("br", null),
				React.createElement(
					"label",
					null,
					React.createElement("input", { type: "checkbox", disabled: !this.state.transparent, onChange: this.handleCheckboxChange, name: "disableByDomain", defaultChecked: this.state.disableByDomain }),
					"\xA0Disable proxy redirection when my domain name contains",
					React.createElement(
						"span",
						null,
						"*"
					)
				),
				React.createElement("br", null),
				React.createElement("input", { style: { marginTop: "0.5em", marginLeft: "1.5em" }, type: "text", onChange: this.handleTextInputChange, disabled: !this.state.transparent || !this.state.disableByDomain, name: "disableByDomainString", defaultValue: this.state.disableByDomainString })
			),
			React.createElement(
				"p",
				null,
				React.createElement(
					"span",
					null,
					"*"
				),
				"Available when Zotero is running"
			)
		);
	}
};

Zotero_Preferences.Components.Proxies = class Proxies extends React.PureComponent {
	constructor(props) {
		super(props);
		this.state = {
			proxies: Zotero.Prefs.get('proxies.proxies'),
			currentProxy: undefined,
			currentHostIdx: -1
		};

		this.handleProxySelectChange = this.handleProxySelectChange.bind(this);
		this.handleProxyButtonClick = this.handleProxyButtonClick.bind(this);
		this.handleSchemeChange = this.handleSchemeChange.bind(this);
		this.handleCheckboxChange = this.handleCheckboxChange.bind(this);
		this.handleHostSelectChange = this.handleHostSelectChange.bind(this);
		this.handleHostButtonClick = this.handleHostButtonClick.bind(this);
		this.handleHostnameChange = this.handleHostnameChange.bind(this);
	}

	componentWillMount() {
		this.saveProxy = Zotero.Utilities.debounce(Zotero.Proxies.save.bind(Zotero.Proxies), 200);
	}

	componentDidUpdate(prevProps, prevState) {
		if (this.focusSchemeInput) {
			this.focusSchemeInput = false;
			this.refs.schemeInput.focus();
		} else if (this.focusHostInput) {
			this.focusHostInput = false;
			this.refs.hostInput.focus();
		}
	}

	/**
  * Update the current proxy with a new one and resave it
  *
  * A lot of this code could be cleaner if state flowed down from the prefs.
  */
	updateCurrentProxyInState(proxy, prevState, newState) {
		newState.currentProxy = proxy;
		newState.proxies = prevState.proxies.map((p, i) => p.id == proxy.id ? proxy : p);
		this.saveProxy(proxy);
	}

	handleProxySelectChange(event) {
		var target = event.target;
		this.setState(prevState => {
			return {
				currentProxy: prevState.proxies.find(p => target && p.id == target.value),
				currentHostIdx: -1
			};
		});
	}

	handleProxyButtonClick(event) {
		var value = event.target.value;
		this.setState(prevState => {
			var newState = {};
			// Add proxy
			if (value == '+') {
				let newProxy = {
					id: Date.now(),
					scheme: '%h.example.com/%p',
					autoAssociate: true,
					hosts: []
				};
				newState.proxies = prevState.proxies.concat([newProxy]);
				newState.currentProxy = newProxy;
				newState.currentHostIdx = -1;
				this.focusSchemeInput = true;
				this.saveProxy(newProxy);
			}
			// Delete proxy
			else if (value == '-') {
					let oldProxies = prevState.proxies;
					let pos = oldProxies.findIndex(p => p == prevState.currentProxy);
					newState.proxies = [...oldProxies.slice(0, pos), ...oldProxies.slice(pos + 1)];
					Zotero.Proxies.remove(prevState.currentProxy);
					newState.currentProxy = oldProxies[pos] || oldProxies[pos - 1];
				}
			return newState;
		});
	}

	handleSchemeChange(event) {
		var value = event.target.value;
		this.setState(prevState => {
			var newState = {};
			var oldProxy = prevState.currentProxy;
			var newProxy = Object.assign({}, oldProxy, {
				scheme: value,
				hosts: [...oldProxy.hosts]
			});
			this.updateCurrentProxyInState(newProxy, prevState, newState);
			return newState;
		});
	}

	handleCheckboxChange(event) {
		var target = event.target;
		this.setState(prevState => {
			var newState = {};
			var oldProxy = prevState.currentProxy;
			var newProxy = Object.assign({}, oldProxy, {
				[target.name]: target.checked
			});
			this.updateCurrentProxyInState(newProxy, prevState, newState);
			return newState;
		});
	}

	handleHostSelectChange(event) {
		this.setState({
			currentHostIdx: event.target.value !== "" ? parseInt(event.target.value) : -1
		});
	}

	handleHostButtonClick(event) {
		var value = event.target.value;
		this.setState(prevState => {
			var newState = {};
			var oldProxy = prevState.currentProxy;
			var newProxy = Object.assign({}, oldProxy);
			// Add host to end
			if (value == '+') {
				newProxy.hosts = oldProxy.hosts.concat(['']);
				newState.currentHostIdx = newProxy.hosts.length - 1;
				this.focusHostInput = true;
			}
			// Delete host at current index
			else if (value == '-') {
					newProxy.hosts = [...oldProxy.hosts.slice(0, prevState.currentHostIdx), ...oldProxy.hosts.slice(prevState.currentHostIdx + 1)];
					// If this was the last host, select the previous one
					if (prevState.currentHostIdx == newProxy.hosts.length) {
						newState.currentHostIdx = prevState.currentHostIdx - 1;
					}
				}
			this.updateCurrentProxyInState(newProxy, prevState, newState);
			return newState;
		});
	}

	handleHostnameChange(event) {
		var value = event.target.value;
		this.setState(prevState => {
			var newState = {};
			var oldProxy = prevState.currentProxy;
			var newProxy = Object.assign({}, oldProxy, {
				// Replace the current host value
				hosts: oldProxy.hosts.map((h, i) => i == prevState.currentHostIdx ? value : h)
			});
			this.updateCurrentProxyInState(newProxy, prevState, newState);
			return newState;
		});
	}

	renderProxySettings() {
		if (!this.props.transparent || !this.state.currentProxy) {
			return "";
		}

		let currentProxy = this.state.currentProxy;
		let multiHost = currentProxy.scheme.indexOf('%h') != -1;

		// If a host exists in the last position and is empty, don't allow adding more
		let disableAddHost = currentProxy.hosts.length && currentProxy.hosts[currentProxy.hosts.length - 1].trim().length == 0;
		let disableRemoveHost = this.state.currentHostIdx == -1;

		return React.createElement(
			"div",
			{ className: "group", style: { marginTop: "10px" } },
			React.createElement(
				"p",
				{ style: { display: "flex", alignItems: "center", flexWrap: "wrap" } },
				React.createElement(
					"label",
					{ style: { visibility: multiHost ? null : 'hidden' } },
					React.createElement("input", { type: "checkbox", name: "autoAssociate", onChange: this.handleCheckboxChange, checked: currentProxy.autoAssociate }),
					"\xA0Automatically associate new hosts"
				),
				React.createElement("br", null),
				React.createElement(
					"label",
					null,
					React.createElement("input", { type: "checkbox", name: "dotsToHyphens", onChange: this.handleCheckboxChange, checked: currentProxy.dotsToHyphens }),
					"\xA0Automatically convert between dots and hyphens in proxied hostnames"
				),
				React.createElement("br", null)
			),
			React.createElement(
				"p",
				{ style: { display: "flex", alignItems: "center" } },
				React.createElement(
					"label",
					{ style: { alignSelf: "center", marginRight: "5px" } },
					"Scheme: "
				),
				React.createElement("input", { style: { flexGrow: "1" }, type: "text", name: "scheme", onChange: this.handleSchemeChange, value: currentProxy.scheme, ref: "schemeInput" })
			),
			React.createElement(
				"p",
				null,
				"You may use the following variables in your proxy scheme:",
				React.createElement("br", null),
				"%h - The hostname of the proxied site (e.g., www.example.com)",
				React.createElement("br", null),
				"%p - The path of the proxied page excluding the leading slash (e.g., about/index.html)",
				React.createElement("br", null),
				"%d - The directory path (e.g., about/)",
				React.createElement("br", null),
				"%f - The filename (e.g., index.html)",
				React.createElement("br", null),
				"%a - Any string"
			),
			React.createElement(
				"div",
				{ style: { display: "flex", flexDirection: "column", marginTop: "10px" } },
				React.createElement(
					"label",
					null,
					"Hostnames"
				),
				React.createElement(
					"select",
					{ className: "Preferences-Proxies-hostSelect", size: "8", multiple: true,
						value: [this.state.currentHostIdx],
						onChange: this.handleHostSelectChange },
					currentProxy.hosts.map((host, i) => React.createElement(
						"option",
						{ key: i, value: i },
						host
					))
				),
				React.createElement(
					"p",
					null,
					React.createElement("input", { style: { minWidth: "80px", marginRight: "10px" }, type: "button", onClick: this.handleHostButtonClick, disabled: disableAddHost, value: "+" }),
					React.createElement("input", { style: { minWidth: "80px", marginRight: "10px" }, type: "button", onClick: this.handleHostButtonClick, disabled: disableRemoveHost, value: "-" })
				),
				React.createElement(
					"p",
					{ style: { display: this.state.currentHostIdx === -1 ? 'none' : 'flex' } },
					React.createElement(
						"label",
						{ style: { alignSelf: 'center', marginRight: "5px" } },
						"Hostname: "
					),
					React.createElement("input", { style: { flexGrow: '1' },
						type: "text",
						value: currentProxy.hosts[this.state.currentHostIdx] || '',
						onChange: this.handleHostnameChange, ref: "hostInput" })
				)
			)
		);
	}

	render() {
		return React.createElement(
			"div",
			{ style: { display: "flex", flexDirection: "column" } },
			React.createElement(
				"select",
				{ className: "Preferences-Proxies-proxySelect", size: "8", multiple: true,
					value: [this.state.currentProxy ? this.state.currentProxy.id : ''],
					onChange: this.handleProxySelectChange,
					disabled: !this.props.transparent },
				this.state.proxies.length && this.state.proxies.map((proxy, i) => {
					return React.createElement(
						"option",
						{ key: i, value: proxy.id },
						proxy.scheme
					);
				})
			),
			React.createElement(
				"p",
				{ style: { display: this.props.transparent ? null : 'none' } },
				React.createElement("input", { style: { minWidth: "80px", marginRight: "10px" }, type: "button", onClick: this.handleProxyButtonClick, value: "+" }),
				React.createElement("input", { style: { minWidth: "80px", marginRight: "10px" }, type: "button", onClick: this.handleProxyButtonClick, disabled: !this.state.currentProxy, value: "-" })
			),
			this.renderProxySettings()
		);
	}
};

Zotero_Preferences.Components.MIMETypeHandling = class MIMETypeHandling extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			enabled: Zotero.Prefs.get('interceptKnownFileTypes'),
			hosts: Zotero.Prefs.get('allowedInterceptHosts'),
			currentHostIdx: -1
		};

		this.handleCheckboxChange = this.handleCheckboxChange.bind(this);
		this.handleSelectChange = this.handleSelectChange.bind(this);
		this.handleHostnameChange = this.handleHostnameChange.bind(this);
		this.handleHostRemove = this.handleHostRemove.bind(this);
	}

	componentWillMount() {
		this.updateHosts = Zotero.Utilities.debounce(this.updateHosts, 200);
	}

	handleCheckboxChange(event) {
		Zotero.Prefs.set('interceptKnownFileTypes', event.target.checked);
		this.setState({ enabled: event.target.checked });
	}

	handleSelectChange(event) {
		this.setState({
			currentHostIdx: event.target.value !== "" ? event.target.value : -1
		});
	}

	handleHostnameChange(event) {
		this.state.hosts[this.state.currentHostIdx] = event.target.value;
		this.updateHosts(this.state.hosts);
	}

	handleHostRemove() {
		this.setState(prevState => {
			var newState = {
				hosts: [...prevState.hosts.slice(0, this.state.currentHostIdx), ...prevState.hosts.slice(this.state.currentHostIdx + 1)],
				currentHostIdx: -1
			};
			this.updateHosts(newState.hosts);
			return newState;
		});
	}

	updateHosts(hosts) {
		this.setState({ hosts });
		Zotero.Prefs.set('allowedInterceptHosts', hosts);
	}

	render() {
		var hosts;
		if (this.state.hosts.length) {
			hosts = this.state.hosts.map((h, i) => React.createElement(
				"option",
				{ value: i, key: i },
				h
			));
		} else {
			hosts = null;
		}
		let hostname = '';
		if (this.state.currentHostIdx != -1) {
			hostname = React.createElement(
				"p",
				{ style: { display: this.state.currentHostIdx === -1 ? 'none' : 'flex' } },
				React.createElement(
					"label",
					{ style: { alignSelf: 'center' } },
					"Hostname: "
				),
				React.createElement("input", { style: { flexGrow: '1' }, type: "text", defaultValue: this.state.hosts[this.state.currentHostIdx] || '', onChange: this.handleHostnameChange })
			);
		}

		var disabled = this.state.currentHostIdx == -1;

		return React.createElement(
			"div",
			null,
			React.createElement(
				"p",
				null,
				"Available when Zotero is running"
			),
			React.createElement(
				"p",
				null,
				React.createElement(
					"label",
					null,
					React.createElement("input", { type: "checkbox", onChange: this.handleCheckboxChange, name: "enabled", defaultChecked: this.state.enabled }),
					"\xA0Import BibTeX/RIS/Refer files into Zotero"
				),
				React.createElement("br", null)
			),
			React.createElement(
				"div",
				{ style: { display: this.state.enabled ? 'flex' : 'none', flexDirection: "column", marginTop: "10px" } },
				React.createElement(
					"label",
					null,
					"Enabled Hostnames"
				),
				React.createElement(
					"select",
					{ className: "Preferences-MIMETypeHandling-hostSelect", size: "8", multiple: true,
						value: this.state.currentHostIdx,
						onChange: this.handleSelectChange },
					hosts
				),
				React.createElement(
					"p",
					null,
					" ",
					React.createElement("input", { style: { minWidth: "80px", marginRight: "10px" }, type: "button", onClick: this.handleHostRemove, disabled: disabled, value: "Remove" }),
					" "
				),
				hostname
			)
		);
	}
};

window.addEventListener("load", Zotero_Preferences.init, false);