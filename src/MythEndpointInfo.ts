import { InfoEmitter } from "@vestibule-link/bridge-assistant-alexa";
import { EndpointInfo, generateEndpointId } from "@vestibule-link/iot-types";
import { masterBackend } from "mythtv-services-api";
import { getLocalEndpoint, MANUFACTURER_NAME, MythAlexaEventFrontend } from "./Frontend";

const ALEXA_FRIENDLY_NAME = "AlexaFriendlyName";

export default class FrontendInfo implements InfoEmitter {
    constructor(readonly fe: MythAlexaEventFrontend) {
        fe.alexaEmitter.on('refreshInfo', this.refreshInfo.bind(this));
    }
    refreshInfo(deltaId: symbol): void {
        const promise = this.updateInfo(deltaId);
        this.fe.alexaEmitter.watchDeltaUpdate(promise, deltaId);
    }

    private async updateInfo(deltaId: symbol): Promise<void> {
        const hostId = this.fe.hostname();
        const alexaDeviceName = await masterBackend.mythService.GetSetting({
            Key: ALEXA_FRIENDLY_NAME,
            HostName: hostId,
            Default: hostId
        });

        const endpointInfo: EndpointInfo = {
            manufacturerName: MANUFACTURER_NAME,
            description: MANUFACTURER_NAME + ' Frontend ' + hostId,
            friendlyName: alexaDeviceName,
            displayCategories: ['TV'],
            endpointId: generateEndpointId(getLocalEndpoint(this.fe))
        }
        this.fe.alexaEmitter.emit('info', endpointInfo, deltaId);
    }
}
