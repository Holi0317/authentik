import { PlexSource, SourcesApi, FlowsApi, FlowDesignationEnum, PlexSourceUserMatchingModeEnum } from "authentik-api";
import { t } from "@lingui/macro";
import { customElement, property } from "lit-element";
import { html, TemplateResult } from "lit-html";
import { DEFAULT_CONFIG } from "../../../api/Config";
import "../../../elements/forms/FormGroup";
import "../../../elements/forms/HorizontalFormElement";
import { ifDefined } from "lit-html/directives/if-defined";
import { until } from "lit-html/directives/until";
import { first, randomString } from "../../../utils";
import { PlexAPIClient, PlexResource, popupCenterScreen} from "../../../flows/sources/plex/API";
import { ModelForm } from "../../../elements/forms/ModelForm";


@customElement("ak-source-plex-form")
export class PlexSourceForm extends ModelForm<PlexSource, string> {

    loadInstance(pk: string): Promise<PlexSource> {
        return new SourcesApi(DEFAULT_CONFIG).sourcesPlexRead({
            slug: pk,
        }).then(source => {
            this.plexToken = source.plexToken;
            this.loadServers();
            return source;
        });
    }

    @property()
    plexToken?: string;

    @property({attribute: false})
    plexResources?: PlexResource[];

    get defaultInstance(): PlexSource | undefined {
        return {
            clientId: randomString(40)
        } as PlexSource;
    }

    getSuccessMessage(): string {
        if (this.instance) {
            return t`Successfully updated source.`;
        } else {
            return t`Successfully created source.`;
        }
    }

    send = (data: PlexSource): Promise<PlexSource> => {
        data.plexToken = this.plexToken;
        if (this.instance?.slug) {
            return new SourcesApi(DEFAULT_CONFIG).sourcesPlexUpdate({
                slug: this.instance.slug,
                data: data
            });
        } else {
            return new SourcesApi(DEFAULT_CONFIG).sourcesPlexCreate({
                data: data
            });
        }
    };

    async doAuth(): Promise<void> {
        const authInfo = await PlexAPIClient.getPin(this.instance?.clientId || "");
        const authWindow = popupCenterScreen(authInfo.authUrl, "plex auth", 550, 700);
        PlexAPIClient.pinPoll(this.instance?.clientId || "", authInfo.pin.id).then(token => {
            authWindow?.close();
            this.plexToken = token;
            this.loadServers();
        });
    }

    async loadServers(): Promise<void> {
        if (!this.plexToken) {
            return;
        }
        this.plexResources = await new PlexAPIClient(this.plexToken).getServers();
    }

    renderForm(): TemplateResult {
        return html`<form class="pf-c-form pf-m-horizontal">
            <ak-form-element-horizontal
                label=${t`Name`}
                ?required=${true}
                name="name">
                <input type="text" value="${ifDefined(this.instance?.name)}" class="pf-c-form-control" required>
            </ak-form-element-horizontal>
            <ak-form-element-horizontal
                label=${t`Slug`}
                ?required=${true}
                name="slug">
                <input type="text" value="${ifDefined(this.instance?.slug)}" class="pf-c-form-control" required>
            </ak-form-element-horizontal>
            <ak-form-element-horizontal name="enabled">
                <div class="pf-c-check">
                    <input type="checkbox" class="pf-c-check__input" ?checked=${first(this.instance?.enabled, true)}>
                    <label class="pf-c-check__label">
                        ${t`Enabled`}
                    </label>
                </div>
            </ak-form-element-horizontal>
            <ak-form-element-horizontal
                label=${t`User matching mode`}
                ?required=${true}
                name="userMatchingMode">
                <select class="pf-c-form-control">
                    <option value=${PlexSourceUserMatchingModeEnum.Identifier} ?selected=${this.instance?.userMatchingMode === PlexSourceUserMatchingModeEnum.Identifier}>
                        ${t`Link users on unique identifier`}
                    </option>
                    <option value=${PlexSourceUserMatchingModeEnum.UsernameLink} ?selected=${this.instance?.userMatchingMode === PlexSourceUserMatchingModeEnum.UsernameLink}>
                        ${t`Link to a user with identical email address. Can have security implications when a source doesn't validate email addresses`}
                    </option>
                    <option value=${PlexSourceUserMatchingModeEnum.UsernameDeny} ?selected=${this.instance?.userMatchingMode === PlexSourceUserMatchingModeEnum.UsernameDeny}>
                        ${t`Use the user's email address, but deny enrollment when the email address already exists.`}
                    </option>
                    <option value=${PlexSourceUserMatchingModeEnum.EmailLink} ?selected=${this.instance?.userMatchingMode === PlexSourceUserMatchingModeEnum.EmailLink}>
                        ${t`Link to a user with identical username address. Can have security implications when a username is used with another source.`}
                    </option>
                    <option value=${PlexSourceUserMatchingModeEnum.EmailDeny} ?selected=${this.instance?.userMatchingMode === PlexSourceUserMatchingModeEnum.EmailDeny}>
                        ${t`Use the user's username, but deny enrollment when the username already exists.`}
                    </option>
                </select>
            </ak-form-element-horizontal>

            <ak-form-group .expanded=${true}>
                <span slot="header">
                    ${t`Protocol settings`}
                </span>
                <div slot="body" class="pf-c-form">
                    <ak-form-element-horizontal
                        label=${t`Client ID`}
                        ?required=${true}
                        name="clientId">
                        <input type="text" value="${first(this.instance?.clientId)}" class="pf-c-form-control" required>
                    </ak-form-element-horizontal>
                    <ak-form-element-horizontal name="allowFriends">
                        <div class="pf-c-check">
                            <input type="checkbox" class="pf-c-check__input" ?checked=${first(this.instance?.allowFriends, true)}>
                            <label class="pf-c-check__label">
                                ${t`Allow friends to authenticate via Plex, even if you don't share any servers`}
                            </label>
                        </div>
                    </ak-form-element-horizontal>
                    <ak-form-element-horizontal
                        label=${t`Allowed servers`}
                        ?required=${true}
                        name="allowedServers">
                        <select class="pf-c-form-control" multiple>
                            ${this.plexResources?.map(r => {
                                const selected = Array.from(this.instance?.allowedServers || []).some(server => {
                                    return server == r.clientIdentifier;
                                });
                                return html`<option value=${r.clientIdentifier} ?selected=${selected}>${r.name}</option>`;
                            })}
                        </select>
                        <p class="pf-c-form__helper-text">${t`Select which server a user has to be a member of to be allowed to authenticate.`}</p>
                        <p class="pf-c-form__helper-text">${t`Hold control/command to select multiple items.`}</p>
                        <p class="pf-c-form__helper-text">
                            <button class="pf-c-button pf-m-primary" type="button" @click=${() => {
                                this.doAuth();
                            }}>
                                ${t`Load servers`}
                            </button>
                        </p>
                    </ak-form-element-horizontal>
                </div>
            </ak-form-group>
            <ak-form-group>
                <span slot="header">
                    ${t`Flow settings`}
                </span>
                <div slot="body" class="pf-c-form">
                    <ak-form-element-horizontal
                        label=${t`Authentication flow`}
                        ?required=${true}
                        name="authenticationFlow">
                        <select class="pf-c-form-control">
                            ${until(new FlowsApi(DEFAULT_CONFIG).flowsInstancesList({
                                ordering: "pk",
                                designation: FlowDesignationEnum.Authentication,
                            }).then(flows => {
                                return flows.results.map(flow => {
                                    let selected = this.instance?.authenticationFlow === flow.pk;
                                    if (!this.instance?.pk && !this.instance?.authenticationFlow && flow.slug === "default-source-authentication") {
                                        selected = true;
                                    }
                                    return html`<option value=${ifDefined(flow.pk)} ?selected=${selected}>${flow.name} (${flow.slug})</option>`;
                                });
                            }), html`<option>${t`Loading...`}</option>`)}
                        </select>
                        <p class="pf-c-form__helper-text">${t`Flow to use when authenticating existing users.`}</p>
                    </ak-form-element-horizontal>
                    <ak-form-element-horizontal
                        label=${t`Enrollment flow`}
                        ?required=${true}
                        name="enrollmentFlow">
                        <select class="pf-c-form-control">
                            ${until(new FlowsApi(DEFAULT_CONFIG).flowsInstancesList({
                                ordering: "pk",
                                designation: FlowDesignationEnum.Enrollment,
                            }).then(flows => {
                                return flows.results.map(flow => {
                                    let selected = this.instance?.enrollmentFlow === flow.pk;
                                    if (!this.instance?.pk && !this.instance?.enrollmentFlow && flow.slug === "default-source-enrollment") {
                                        selected = true;
                                    }
                                    return html`<option value=${ifDefined(flow.pk)} ?selected=${selected}>${flow.name} (${flow.slug})</option>`;
                                });
                            }), html`<option>${t`Loading...`}</option>`)}
                        </select>
                        <p class="pf-c-form__helper-text">${t`Flow to use when enrolling new users.`}</p>
                    </ak-form-element-horizontal>
                </div>
            </ak-form-group>
        </form>`;
    }

}