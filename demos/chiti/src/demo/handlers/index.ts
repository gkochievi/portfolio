/**
 * Registers every route. Each module self-registers with `api.register` at
 * top level (patterns WITHOUT the `/api` prefix). Data-core owns auth + core;
 * each feature group owns its own file.
 */
import './auth'
import './core'
import './widget'
import './inbox'
import './operator-tools'
import './team'
import './admin-live'
import './admin-staff'
import './admin-insights'
import './admin-settings'
import './admin-integrations'
import './superadmin'
