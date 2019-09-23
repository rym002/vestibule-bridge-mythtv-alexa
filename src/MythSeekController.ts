import { SeekController } from "@vestibule-link/alexa-video-skill-types";
import { CapabilityEmitter, DirectiveHandlers, SupportedDirectives } from "@vestibule-link/bridge-assistant-alexa";
import { SubType } from "@vestibule-link/iot-types";
import { duration } from 'moment';
import { masterBackend, ApiTypes } from "mythtv-services-api";
import { connect } from 'net';
import { MythAlexaEventFrontend } from "./Frontend";


type DirectiveType = SeekController.NamespaceType;
const DirectiveName: DirectiveType = SeekController.namespace;
type Response = {
    payload: SeekController.ResponsePayload
}
export default class FrontendSeek
    implements SubType<DirectiveHandlers, DirectiveType>, CapabilityEmitter {
    controlPort: number = 6546;
    readonly supported: SupportedDirectives<DirectiveType> = ['AdjustSeekPosition'];
    constructor(readonly fe: MythAlexaEventFrontend) {
        fe.alexaEmitter.on('refreshCapability', this.refreshCapability.bind(this));
        fe.alexaEmitter.registerDirectiveHandler(DirectiveName, this);
    }
    refreshCapability(deltaId: symbol): void {
        const promise = this.updateCapability(deltaId);
        this.fe.alexaEmitter.watchDeltaUpdate(promise, deltaId);
    }

    private async updateCapability(deltaId: symbol): Promise<void> {
        try {
            await this.verify();
            this.fe.alexaEmitter.emit('capability', DirectiveName, true, deltaId);
        } catch (e) {
            console.log(e)
        }

    }
    async getState(): Promise<ApiTypes.State> {
        const status = await this.fe.GetRefreshedStatus();
        return status.State;
    }
    async AdjustSeekPosition(payload: SeekController.RequestPayload): Promise<Response> {
        const deltaPositionMilliseconds = payload.deltaPositionMilliseconds;
        let state = await this.getState();
        let desiredPostition = (state.secondsplayed * 1000) + deltaPositionMilliseconds;
        const totalAvailable = state.totalseconds * 1000;
        desiredPostition = Math.min(totalAvailable, Math.max(0, desiredPostition));

        const dur = duration(desiredPostition);
        const seekPosition = dur.hours().toString().padStart(2, '0')
            + ':' + dur.minutes().toString().padStart(2, '0')
            + ':' + dur.seconds().toString().padStart(2, '0');
        const command = 'play seek ' + seekPosition;
        await this.sendNetworkCommand(command);
        state = await this.getState();
        return {
            payload: {
                properties: [{
                    name: 'positionMilliseconds',
                    value: state.secondsplayed * 1000
                }]
            }
        }
    }

    private sendNetworkCommand(command: string): Promise<void> {
        const promise = new Promise<void>((resolve, reject) => {
            const client = connect(this.controlPort, this.fe.hostname(), () => {
                client.on('error', err => {
                    reject(err);
                })
                client.on('data', data => {
                    const resp = data.toLocaleString();
                    if (resp.startsWith('OK') || resp.startsWith('ERROR')) {
                        client.destroy();
                        if (resp.startsWith('OK')) {
                            resolve();
                        }
                        if (resp.startsWith('ERROR')) {
                            reject(resp);
                        }
                    } else {
                        client.write(command + '\nquit\n');
                    }
                })
            })
            client.on('error', err => {
                reject(err);
            })
        });
        return promise;
    }

    private async verify(): Promise<void> {
        const enabled = await masterBackend.mythService.GetSetting({
            Key: 'NetworkControlEnabled',
            HostName: this.fe.hostname()
        });
        if (enabled != '1') {
            throw ('NetworkControlEnabled not enabled')
        }
        const portValue = await masterBackend.mythService.GetSetting({
            Key: 'NetworkControlPort',
            HostName: this.fe.hostname(),
            Default: this.controlPort + ''
        })
        this.controlPort = Number(portValue);
    }
}