import { serviceProviderManager } from "@vestibule-link/bridge-service-provider";
import { AlexaEndpointConnector } from "@vestibule-link/bridge-assistant-alexa";
import { frontends, mergeObject, MythEventFrontend } from "@vestibule-link/bridge-mythtv";
import { EndpointState, ErrorHolder, SubType } from "@vestibule-link/iot-types";
import { isEqual } from 'lodash';
import { MythSenderEventEmitter } from "mythtv-event-emitter";
import { EventMapping } from "mythtv-event-emitter/dist/messages";
import { Frontend, masterBackend } from "mythtv-services-api";
import FrontendChannel from "./MythChannelController";
import FrontendHealth from "./MythEndpointHealth";
import FrontendInfo from "./MythEndpointInfo";
import FrontendKeypad from "./MythKeypadController";
import FrontendLauncher from "./MythLauncher";
import FrontendPlayback from "./MythPlaybackController";
import FrontendPlaybackState from "./MythPlaybackState";
import FrontendPower from "./MythPowerController";
import FrontendRecord from "./MythRecordController";
import FrontendVideoPlayer from "./MythRemoteVideoPlayer";
import FrontendSeek from "./MythSeekController";
import MythTvRecorder from "./MythVideoRecorder";
import FrontendWol from "./MythWol";

const ALEXA_ENABLED = 'AlexaEnabled';
const TRUE = "true";
export const MANUFACTURER_NAME = 'MythTV'
export const STATE_EVENT_TIMEOUT = Number(process.env['MYTHTV_STATE_EVENT_TIMEOUT'] || 3000)
export interface MythAlexaEventFrontend extends MythEventFrontend {
    readonly alexaConnector: AlexaEndpointConnector
    monitorStateChange<NS extends keyof EndpointState, N extends keyof EndpointState[NS]>(namespace: NS, expected?: {
        name: N, value: SubType<SubType<EndpointState, NS>, N>
    }): Promise<EndpointState>;
}

export class AlexaEventFrontend {
    readonly mythEventEmitter: MythSenderEventEmitter
    readonly masterBackendEmitter: MythSenderEventEmitter
    constructor(readonly alexaConnector: AlexaEndpointConnector, private readonly fe: MythEventFrontend) {
        this.mythEventEmitter = fe.mythEventEmitter
        this.masterBackendEmitter = fe.masterBackendEmitter
        fe.mythEventEmitter.on('post', (eventType, message) => {
            this.alexaConnector.completeDeltaState(this.fe.eventDeltaId());
        })
        this.fe.addConnectionMonitor('alexa', alexaConnector, () => {
            this.alexaConnector.refreshState(this.fe.eventDeltaId())
        })
    }
    monitorStateChange<NS extends keyof EndpointState, N extends keyof EndpointState[NS]>(namespace: NS, expected?: {
        name: N, value: SubType<SubType<EndpointState, NS>, N>
    }): Promise<EndpointState | undefined> {
        return new Promise((resolve, reject) => {
            if (expected !== undefined) {
                const currentState = this.alexaConnector.reportedState;
                if (currentState[namespace]) {
                    const namespaceValue = currentState[namespace];
                    if (isEqual(namespaceValue[expected.name], expected.value)) {
                        resolve(undefined)
                        return;
                    }
                }
            }
            const alexaStateEmitter = this.alexaConnector.alexaStateEmitter;
            const timeoutId = setTimeout(() => {
                alexaStateEmitter.removeListener(namespace, listener)
                const error: ErrorHolder = {
                    errorType: 'Alexa',
                    errorPayload: {
                        type: 'ENDPOINT_BUSY',
                        message: 'State Timeout ' + namespace
                    }
                }
                reject(error)
            }, STATE_EVENT_TIMEOUT);
            const listener: (name: N, value: SubType<SubType<EndpointState, NS>, N>) => void = (name, value) => {
                clearTimeout(timeoutId);
                resolve({
                    [namespace]: {
                        [name]: value
                    }
                })
            }
            alexaStateEmitter.once(namespace, listener)
        })
    }
    async monitorMythEvent<T extends keyof EventMapping, P extends EventMapping[T]>(eventName: T, timeout: number): Promise<P> {
        try {
            return await this.fe.monitorMythEvent(eventName, timeout)
        } catch (err) {
            const error: ErrorHolder = {
                errorType: 'Alexa',
                errorPayload: {
                    type: 'ENDPOINT_BUSY',
                    message: err.message
                }
            }
            throw error
        }
    }
}

export async function registerFrontends(): Promise<void> {
    const fePromises = frontends.map(async fe => {
        const enabled = await masterBackend.mythService.GetSetting({
            Key: ALEXA_ENABLED,
            HostName: fe.hostname(),
            Default: TRUE
        });
        if (enabled == TRUE) {
            const alexaConnector = await serviceProviderManager.getEndpointConnector('alexa', getEndpointName(fe), true)
            const alexaFe = new AlexaEventFrontend(alexaConnector, fe);
            const mergedFe: MythAlexaEventFrontend = mergeObject(alexaFe, fe);
            await buildEndpoint(mergedFe);
            await alexaConnector.refresh(Symbol())
        }
    })
    await Promise.all(fePromises)
}


async function buildEndpoint(fe: MythAlexaEventFrontend): Promise<void> {
    const handlerRegistrations = directiveBuilders.map((db) => {
        const handler = db.createHandler(fe);
        return handler.register()
    });

    await Promise.all(handlerRegistrations)
}

export function getEndpointName(fe: Frontend.Service): string {
    return getEndpointNameFromHostname(fe.hostname())
}

export function getEndpointNameFromHostname(hostname: string) {
    return `${MANUFACTURER_NAME}_${hostname}`
}
export interface RegisteringDirective {
    register(): Promise<void>
}
interface DirectiveBuilder {
    createHandler(fe: MythAlexaEventFrontend): RegisteringDirective;
}

const directiveBuilders: DirectiveBuilder[] = [{
    createHandler(fe: MythAlexaEventFrontend): RegisteringDirective {
        return new FrontendPlayback(fe);
    }
}, {
    createHandler(fe: MythAlexaEventFrontend): RegisteringDirective {
        return new FrontendRecord(fe);
    }
}, {
    createHandler(fe: MythAlexaEventFrontend): RegisteringDirective {
        return new FrontendChannel(fe);
    }
}, {
    createHandler(fe: MythAlexaEventFrontend): RegisteringDirective {
        return new FrontendPower(fe);
    }
}, {
    createHandler(fe: MythAlexaEventFrontend): RegisteringDirective {
        return new FrontendSeek(fe);
    }
}, {
    createHandler(fe: MythAlexaEventFrontend): RegisteringDirective {
        return new FrontendPlaybackState(fe);
    }
}, {
    createHandler(fe: MythAlexaEventFrontend): RegisteringDirective {
        return new FrontendWol(fe);
    }
}, {
    createHandler(fe: MythAlexaEventFrontend): RegisteringDirective {
        return new FrontendHealth(fe);
    }
}, {
    createHandler(fe: MythAlexaEventFrontend): RegisteringDirective {
        return new FrontendVideoPlayer(fe);
    }
}, {
    createHandler(fe: MythAlexaEventFrontend): RegisteringDirective {
        return new FrontendLauncher(fe);
    }
}, {
    createHandler(fe: MythAlexaEventFrontend): RegisteringDirective {
        return new MythTvRecorder(fe);
    }
}, {
    createHandler(fe: MythAlexaEventFrontend): RegisteringDirective {
        return new FrontendInfo(fe);
    }
}, {
    createHandler(fe: MythAlexaEventFrontend): RegisteringDirective {
        return new FrontendKeypad(fe);
    }
}]
