import { WakeOnLANController } from "@vestibule-link/alexa-video-skill-types";
import { CapabilityEmitter } from "@vestibule-link/bridge-assistant-alexa";
import * as nodeArp from 'node-arp';
import { promisify } from "util";
import { MythAlexaEventFrontend } from "./Frontend";
import { spawn } from "child_process";

type DirectiveType = WakeOnLANController.NamespaceType;
const DirectiveName: DirectiveType = WakeOnLANController.namespace;

export default class FrontendWol
    implements CapabilityEmitter {
    readonly getMAC = promisify(nodeArp.getMAC);
    private readonly spawnCommands = ['arp', 'ping'];
    constructor(readonly fe: MythAlexaEventFrontend) {
        fe.alexaConnector.listenRefreshEvents(this)
    }
    refreshCapability(deltaId: symbol): void {
        const promise = this.updateCapability(deltaId);
        this.fe.alexaConnector.watchDeltaUpdate(promise, deltaId);
    }
    private async updateCapability(deltaId: symbol): Promise<void> {
        const capabilities = await this.capabilities();
        this.fe.alexaConnector.updateCapability(DirectiveName, capabilities, deltaId);
    }
    async checkNodeArp(commandName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const arp = spawn('which', [commandName])
            arp.on('error', (err) => {
                reject(err)
            })
            arp.on('exit', (code, signal) => {
                if (code) {
                    reject(new Error('Failed to find ' + commandName))
                }
                resolve()
            })
        })
    }
    private async capabilities(): Promise<string[] | undefined> {
        try {
            const spawns = this.spawnCommands.map(async command => {
                await this.checkNodeArp(command)
            })
            await Promise.all(spawns)
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