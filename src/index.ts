import { registerModule } from '@vestibule-link/bridge';
import { registerFrontends } from 'Frontend';
import { startModule as alexaStartModule } from '@vestibule-link/bridge-assistant-alexa'
import { startModule as mythtvStartModule } from '@vestibule-link/bridge-mythtv'
let moduleId: symbol | undefined;

export function startModule() {
    if (!moduleId) {
        moduleId = registerModule({
            name: 'mythtv-alexa',
            init: async () => {
                await registerFrontends()
            },
            depends: [alexaStartModule(), mythtvStartModule()]
        })
    }
    return moduleId;
}
