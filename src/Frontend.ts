import { providersEmitter } from "@vestibule-link/bridge-assistant";
import { AlexaEndpointEmitter } from "@vestibule-link/bridge-assistant-alexa";
import { frontends, mergeObject, MythEventFrontend } from "@vestibule-link/bridge-mythtv";
import { LocalEndpoint } from "@vestibule-link/iot-types";
import { backend, Frontend } from "mythtv-services-api";
import FrontendChannel  from "./MythChannelController";
import FrontendHealth from "./MythEndpointHealth";
import FrontendInfo from "./MythEndpointInfo";
import FrontendLauncher from "./MythLauncher";
import FrontendPlayback from "./MythPlaybackController";
import FrontendPlaybackState from "./MythPlaybackState";
import FrontendPower from "./MythPowerController";
import FrontendRecord from "./MythRecordController";
import FrontendVideoPlayer from "./MythRemoteVideoPlayer";
import FrontendSeek from "./MythSeekController";
import MythTvRecorder from "./MythVideoRecorder";
import FrontendWol from "./MythWol";
import { MythSenderEventEmitter } from "mythtv-event-emitter";


const ALEXA_ENABLED = 'AlexaEnabled';
const TRUE = "true";
export const MANUFACTURER_NAME = 'MythTV'

export interface MythAlexaEventFrontend extends MythEventFrontend {
    readonly alexaEmitter: AlexaEndpointEmitter
}

class AlexaEventFrontend {
    readonly mythEventEmitter: MythSenderEventEmitter
    constructor(readonly alexaEmitter: AlexaEndpointEmitter, private readonly fe: MythEventFrontend) {
        this.mythEventEmitter = fe.mythEventEmitter
        fe.mythEventEmitter.on('post',(eventType,message)=>{
            this.alexaEmitter.completeDelta(this.fe.eventDeltaId());
        })
    }
}

export async function registerFrontends(): Promise<void> {
    const fePromises = frontends.map(async fe => {
        const enabled = await backend.mythService.GetSetting({
            Key: ALEXA_ENABLED,
            HostName: fe.hostname(),
            Default: TRUE
        });
        if (enabled == TRUE) {
            const alexaEmitter = <AlexaEndpointEmitter>providersEmitter.getEndpointEmitter('alexa', { provider: MANUFACTURER_NAME, host: fe.hostname() }, true)
            const alexaFe = new AlexaEventFrontend(alexaEmitter, fe);
            const mergedFe: MythAlexaEventFrontend = mergeObject(alexaFe, fe);
            buildEndpoint(mergedFe);
        }
    })
    await Promise.all(fePromises)
    providersEmitter.emit('refresh', 'alexa');
}


function buildEndpoint(fe: MythAlexaEventFrontend): void {
    directiveBuilders.forEach((db) => {
        db.createHandler(fe);
    });
}

export function getLocalEndpoint(fe: Frontend): LocalEndpoint {
    return {
        provider: MANUFACTURER_NAME,
        host: fe.hostname()
    };
}
interface DirectiveBuilder {
    createHandler(fe: MythAlexaEventFrontend): void;
}

const directiveBuilders: DirectiveBuilder[] = [{
    createHandler(fe: MythAlexaEventFrontend): void {
        new FrontendPlayback(fe);
    }
}, {
    createHandler(fe: MythAlexaEventFrontend): void {
        new FrontendRecord(fe);
    }
}, {
    createHandler(fe: MythAlexaEventFrontend): void {
        new FrontendChannel(fe);
    }
}, {
    createHandler(fe: MythAlexaEventFrontend): void {
        new FrontendPower(fe);
    }
}, {
    createHandler(fe: MythAlexaEventFrontend): void {
        new FrontendSeek(fe);
    }
}, {
    createHandler(fe: MythAlexaEventFrontend): void {
        new FrontendPlaybackState(fe);
    }
}, {
    createHandler(fe: MythAlexaEventFrontend): void {
        new FrontendWol(fe);
    }
}, {
    createHandler(fe: MythAlexaEventFrontend): void {
        new FrontendHealth(fe);
    }
}, {
    createHandler(fe: MythAlexaEventFrontend): void {
        new FrontendVideoPlayer(fe);
    }
}, {
    createHandler(fe: MythAlexaEventFrontend): void {
        new FrontendLauncher(fe);
    }
}, {
    createHandler(fe: MythAlexaEventFrontend): void {
        new MythTvRecorder(fe);
    }
}, {
    createHandler(fe: MythAlexaEventFrontend): void {
        new FrontendInfo(fe);
    }
}]
