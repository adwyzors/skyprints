export enum Permission {
    ORDERS_VIEW = "orders:view",
    ORDERS_CREATE = "orders:create",
    ORDERS_UPDATE = "orders:update",
    ORDERS_DELETE = "orders:delete",
    ORDERS_REORDER = "orders:reorder",

    PROCESS_VIEW = "process:view",
    PROCESS_CREATE = "process:create",
    PROCESS_UPDATE = "process:update",
    PROCESS_DELETE = "process:delete",

    RUNS_VIEW = "runs:view",
    RUNS_CREATE = "runs:create",
    RUNS_DELETE = "runs:delete",
    RUNS_UPDATE = "runs:update",
    RUNS_LIFECYCLE_ROLLBACK = "runs:lifecycle:rollback",
    RUNS_LIFECYCLE_UPDATE = "runs:lifecycle:update",
    RUNS_TRANSITION_DIGITAL = "runs:transition:digital",
    RUNS_TRANSITION_FUSING = "runs:transition:fusing",

    RATES_VIEW = "rates:view",
    RATES_CREATE = "rates:create",
    RATES_UPDATE = "rates:update",
    RATES_DELETE = "rates:delete",

    BILLINGS_VIEW = "billings:view",
    BILLINGS_CREATE = "billings:create",
    BILLINGS_UPDATE = "billings:update",
    BILLINGS_DELETE = "billings:delete",

    CUSTOMERS_VIEW = "customers:view",
    CUSTOMERS_CREATE = "customers:create",
    CUSTOMERS_UPDATE = "customers:update",
    CUSTOMERS_DELETE = "customers:delete",

    ANALYTICS_VIEW = "analytics:view",
    ANALYTICS_SYNC = "analytics:sync",

    USERS_VIEW = "users:view",
    USERS_CREATE = "users:create",
    USERS_UPDATE = "users:update",
    USERS_DELETE = "users:delete",

    LOCATIONS_VIEW = "locations:view",
    LOCATIONS_CREATE = "locations:create",
    LOCATIONS_UPDATE = "locations:update",
    LOCATIONS_DELETE = "locations:delete",
    LOCATIONS_ALL_VIEW = "locations:all:view",
}
