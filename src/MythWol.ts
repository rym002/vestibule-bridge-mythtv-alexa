import { WakeOnLANController } from "@vestibule-link/alexa-video-skill-types";
import { CapabilityEmitter } from "@vestibule-link/bridge-assistant-alexa";
import * as nodeArp from 'node-arp';
import { promisify } from "util";
import { MythAlexaEventFrontend } from "./Frontend";

type DirectiveType = WakeOnLANController.NamespaceType;
const DirectiveName: DirectiveType = WakeOnLANController.namespace;

export default class FrontendWol
    implements CapabilityEmitter {
    readonly getMAC = promisify(nodeArp.getMAC);
    constructor(readonly fe: MythAlexaEventFrontend) {
        fe.alexaEmitter.on('refreshCapability', this.refreshCapability.bind(this));
    }
    refreshCapability(deltaId: symbol): void {
        const promise = this.updateCapability(deltaId);
        this.fe.alexaEmitter.watchDeltaUpdate(promise, deltaId);
    }
    private async updateCapability(deltaId: symbol): Promise<void> {
        const capabilities = await this.capabilities();
        this.fe.alexaEmitter.emit('capability', DirectiveName, capabilities, deltaId);
    }
    private async capabilities(): Promise<string[]|undefined> {
        try {
            const mac = await this.getMAC(this.fe.hostname());
            if (mac) {
                return [mac];
            }
            throw 'MAC Not found for ' + this.fe.hostname();
        } catch (err) {            
            console.error(err);
            return undefined
        }
    }
}