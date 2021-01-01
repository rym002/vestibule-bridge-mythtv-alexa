import { KeypadController } from "@vestibule-link/alexa-video-skill-types";
import { CapabilityEmitter, DirectiveHandlers, SupportedDirectives } from "@vestibule-link/bridge-assistant-alexa";
import { SubType } from "@vestibule-link/iot-types";
import { MythAlexaEventFrontend } from "./Frontend";
import { keys } from 'lodash'
type DirectiveType = KeypadController.NamespaceType;
const DirectiveName: DirectiveType = KeypadController.namespace;
type Response = {
    payload: {}
}

type KeyMapping = {
    [K in KeypadController.Keys]: string
}
export default class FrontendKeypadController
    implements SubType<DirectiveHandlers, DirectiveType>, CapabilityEmitter {
    readonly supported: SupportedDirectives<DirectiveType> = ['SendKeystroke'];
    readonly mappings: KeyMapping = {
        'UP': 'UP',
        'DOWN': 'DOWN',
        'LEFT': 'LEFT',
        'RIGHT': 'RIGHT',
        'SELECT': 'SELECT',
        'PAGE_UP': 'PAGEUP',
        'PAGE_DOWN': 'PAGEDOWN',
        'PAGE_LEFT': 'PAGELEFT',
        'PAGE_RIGHT': 'PAGERIGHT',
        'INFO': 'INFO',
        'MORE': 'DETAILS'
    }
    constructor(readonly fe: MythAlexaEventFrontend) {
        fe.alexaConnector.registerDirectiveHandler(DirectiveName, this);
    }
    refreshCapability(deltaId: symbol): void {
        this.fe.alexaConnector.updateCapability(DirectiveName, <KeypadController.Keys[]>keys(this.mappings), deltaId);
    }
    async SendKeystroke(payload: KeypadController.SendKeystrokeRequest): Promise<Response> {
        await this.fe.SendAction({
            Action: this.mappings[payload.keystroke]
        })
        return {
            payload: {}
        }
    }
}