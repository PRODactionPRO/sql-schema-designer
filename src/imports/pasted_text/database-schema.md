
erDiagram
    USERS {
        uuid id PK
        citext email
        text timezone
    }

    WORKSPACES {
        uuid id PK
        uuid owner_user_id FK
        text name
        text status
    }

    WORKSPACE_MEMBERS {
        uuid id PK
        uuid workspace_id FK
        uuid user_id FK
        text role
    }

    WORKSPACE_INVITES {
        uuid id PK
        uuid workspace_id FK
        citext email
        text role
        text status
    }

    PLANS {
        uuid id PK
        text code
        text name
    }

    PLAN_ENTITLEMENTS {
        uuid id PK
        uuid plan_id FK
        text code
    }

    WORKSPACE_SUBSCRIPTIONS {
        uuid id PK
        uuid workspace_id FK
        uuid plan_id FK
        text status
    }

    BRANDS {
        uuid id PK
        uuid workspace_id FK
        text name
        jsonb brand_context
    }

    BRAND_SNAPSHOTS {
        uuid id PK
        uuid brand_id FK
        text snapshot_type
    }

    PRODUCTS {
        uuid id PK
        uuid brand_id FK
        text name
        jsonb product_context
    }

    OFFERS {
        uuid id PK
        uuid brand_id FK
        uuid product_id FK
        text name
    }

    COMPETITORS {
        uuid id PK
        uuid brand_id FK
        text name
        numeric nnn_value
    }

    AUDIENCE_SEGMENTS {
        uuid id PK
        uuid brand_id FK
        text name
        jsonb audience_context
        jsonb cjm
    }

    PRODUCT_AUDIENCE_SEGMENTS {
        uuid id PK
        uuid product_id FK
        uuid audience_segment_id FK
    }

    FUNNEL_STAGES {
        uuid id PK
        text code
        integer sort_order
    }

    PLATFORM_PROFILES {
        uuid id PK
        text code
        text name
        jsonb profile_data
    }

    PLATFORM_FORMATS {
        uuid id PK
        uuid platform_profile_id FK
        text format_type
        text format_subtype
    }

    PLATFORM_BEST_PRACTICES {
        uuid id PK
        uuid platform_profile_id FK
        text category
        text item
    }

    CHANNELS {
        uuid id PK
        uuid brand_id FK
        uuid platform_profile_id FK
        text name
        text url
        text publishing_mode
    }

    CHANNEL_CONNECTIONS {
        uuid id PK
        uuid channel_id FK
        text auth_provider
        text secret_ref
    }

    CHANNEL_OVERRIDES {
        uuid id PK
        uuid channel_id FK
        jsonb settings
    }

    CHANNEL_TARGET_SEGMENTS {
        uuid id PK
        uuid channel_id FK
        uuid audience_segment_id FK
    }

    CHANNEL_FUNNEL_ROLES {
        uuid id PK
        uuid channel_id FK
        uuid funnel_stage_id FK
    }

    CHANNEL_DAILY_STATS {
        uuid id PK
        uuid channel_id FK
        date stat_date
    }

    STRATEGY_CYCLES {
        uuid id PK
        uuid brand_id FK
        date period_start
        date period_end
        text primary_goal
    }

    CONTENT_CAMPAIGNS {
        uuid id PK
        uuid brand_id FK
        uuid strategy_cycle_id FK
        uuid audience_segment_id FK
        uuid product_id FK
        uuid channel_id FK
        text name
    }

    TRIGGER_TYPES {
        uuid id PK
        text code
        text name
    }

    CONTENT_TOPICS {
        uuid id PK
        uuid brand_id FK
        uuid strategy_cycle_id FK
        uuid content_campaign_id FK
        uuid audience_segment_id FK
        uuid product_id FK
        uuid offer_id FK
        uuid trigger_type_id FK
        uuid funnel_stage_id FK
        text title
    }

    CONTENT_BRIEFS {
        uuid id PK
        uuid brand_id FK
        uuid content_topic_id FK
        uuid channel_id FK
        jsonb content_passport
    }

    SCHEDULE_ITEMS {
        uuid id PK
        uuid brand_id FK
        uuid content_brief_id FK
        uuid channel_id FK
        timestamptz scheduled_for
    }

    CONTENT_ITEMS {
        uuid id PK
        uuid brand_id FK
        uuid channel_id FK
        uuid content_topic_id FK
        uuid content_brief_id FK
        uuid schedule_item_id FK
        text content_type
        text workflow_status
    }

    CONTENT_ITEM_VERSIONS {
        uuid id PK
        uuid content_item_id FK
        integer version_number
        uuid created_from_ai_job_id FK
    }

    CONTENT_FEEDBACK_EVENTS {
        uuid id PK
        uuid content_item_version_id FK
        text feedback_type
    }

    AI_FUNCTIONS {
        uuid id PK
        text code
        text name
        text output_type
    }

    PROMPT_TEMPLATES {
        uuid id PK
        uuid ai_function_id FK
        text code
        text scope_type
        uuid scope_id
    }

    PROMPT_TEMPLATE_VERSIONS {
        uuid id PK
        uuid prompt_template_id FK
        integer version_number
        text status
    }

    AI_JOBS {
        uuid id PK
        uuid parent_job_id FK
        uuid workspace_id FK
        uuid brand_id FK
        uuid ai_function_id FK
        uuid prompt_template_version_id FK
        text target_type
        uuid target_id
        text status
    }

    AI_FEEDBACK_EVENTS {
        uuid id PK
        uuid ai_job_id FK
        uuid prompt_template_version_id FK
        uuid content_item_id FK
    }

    LIBRARY_ASSETS {
        uuid id PK
        uuid brand_id FK
        text asset_type
        text source_type
    }

    CONTENT_ITEM_ASSETS {
        uuid id PK
        uuid content_item_version_id FK
        uuid asset_id FK
        text role
    }

    VIDEO_PROJECTS {
        uuid id PK
        uuid brand_id FK
        uuid content_item_id FK
        uuid content_topic_id FK
        uuid content_brief_id FK
        text status
    }

    VIDEO_SCRIPT_VERSIONS {
        uuid id PK
        uuid video_project_id FK
        integer version_number
    }

    VIDEO_SCENES {
        uuid id PK
        uuid video_script_version_id FK
        integer scene_index
        jsonb scene_spec
    }

    VIDEO_SCENE_ASSETS {
        uuid id PK
        uuid video_scene_id FK
        uuid asset_id FK
        text role
    }

    SEO_RESEARCH_RUNS {
        uuid id PK
        uuid brand_id FK
        uuid strategy_cycle_id FK
        uuid audience_segment_id FK
        uuid product_id FK
        text provider
        text status
    }

    SEO_KEYWORDS {
        uuid id PK
        uuid seo_research_run_id FK
        text keyword
        integer search_volume
        text intent
    }

    CONTENT_SEO_TARGETS {
        uuid id PK
        uuid brand_id FK
        uuid seo_research_run_id FK
        uuid content_topic_id FK
        uuid content_brief_id FK
        uuid content_item_id FK
    }

    PUBLISH_JOBS {
        uuid id PK
        uuid content_item_id FK
        uuid channel_id FK
        text publish_mode
        text status
        text platform_message_id
    }

    TRACKING_LINKS {
        uuid id PK
        uuid brand_id FK
        uuid channel_id FK
        uuid content_item_id FK
        text short_url
    }

    CONTENT_ITEM_METRICS {
        uuid id PK
        uuid content_item_id FK
        date metric_date
    }

    CONVERSION_EVENTS {
        uuid id PK
        uuid brand_id FK
        uuid tracking_link_id FK
        uuid content_item_id FK
        text event_type
        numeric value_amount
    }

    CONTENT_ATTRIBUTIONS {
        uuid id PK
        uuid conversion_event_id FK
        uuid content_item_id FK
        text attribution_model
    }

    ANALYTICS_INSIGHTS {
        uuid id PK
        uuid brand_id FK
        uuid strategy_cycle_id FK
        uuid channel_id FK
        uuid content_item_id FK
        uuid source_ai_job_id FK
    }

    USAGE_EVENTS {
        uuid id PK
        uuid workspace_id FK
        uuid brand_id FK
        uuid ai_job_id FK
        text event_type
        numeric estimated_cost
    }

    USERS ||--o{ WORKSPACES : owns
    USERS ||--o{ WORKSPACE_MEMBERS : joins
    WORKSPACES ||--o{ WORKSPACE_MEMBERS : has
    WORKSPACES ||--o{ WORKSPACE_INVITES : has
    PLANS ||--o{ PLAN_ENTITLEMENTS : defines
    WORKSPACES ||--o{ WORKSPACE_SUBSCRIPTIONS : bills
    PLANS ||--o{ WORKSPACE_SUBSCRIPTIONS : prices

    WORKSPACES ||--|| BRANDS : contains
    BRANDS ||--o{ BRAND_SNAPSHOTS : versions
    BRANDS ||--o{ PRODUCTS : sells
    BRANDS ||--o{ OFFERS : packages
    PRODUCTS o|--o{ OFFERS : supports
    BRANDS ||--o{ COMPETITORS : tracks
    BRANDS ||--o{ AUDIENCE_SEGMENTS : targets
    PRODUCTS ||--o{ PRODUCT_AUDIENCE_SEGMENTS : maps
    AUDIENCE_SEGMENTS ||--o{ PRODUCT_AUDIENCE_SEGMENTS : maps

    PLATFORM_PROFILES ||--o{ PLATFORM_FORMATS : defines
    PLATFORM_PROFILES ||--o{ PLATFORM_BEST_PRACTICES : stores
    BRANDS ||--o{ CHANNELS : owns
    PLATFORM_PROFILES ||--o{ CHANNELS : templates
    CHANNELS ||--|| CHANNEL_CONNECTIONS : authenticates
    CHANNELS ||--|| CHANNEL_OVERRIDES : overrides
    CHANNELS ||--o{ CHANNEL_TARGET_SEGMENTS : targets
    AUDIENCE_SEGMENTS ||--o{ CHANNEL_TARGET_SEGMENTS : serves
    CHANNELS ||--o{ CHANNEL_FUNNEL_ROLES : plays
    FUNNEL_STAGES ||--o{ CHANNEL_FUNNEL_ROLES : categorizes
    CHANNELS ||--o{ CHANNEL_DAILY_STATS : measures

    BRANDS ||--o{ STRATEGY_CYCLES : plans
    STRATEGY_CYCLES ||--o{ CONTENT_CAMPAIGNS : drives
    BRANDS ||--o{ CONTENT_CAMPAIGNS : owns
    PRODUCTS o|--o{ CONTENT_CAMPAIGNS : focuses
    AUDIENCE_SEGMENTS o|--o{ CONTENT_CAMPAIGNS : addresses
    CHANNELS o|--o{ CONTENT_CAMPAIGNS : distributes

    BRANDS ||--o{ CONTENT_TOPICS : ideates
    STRATEGY_CYCLES o|--o{ CONTENT_TOPICS : informs
    CONTENT_CAMPAIGNS o|--o{ CONTENT_TOPICS : groups
    PRODUCTS o|--o{ CONTENT_TOPICS : for
    OFFERS o|--o{ CONTENT_TOPICS : promotes
    AUDIENCE_SEGMENTS ||--o{ CONTENT_TOPICS : addresses
    TRIGGER_TYPES o|--o{ CONTENT_TOPICS : triggers
    FUNNEL_STAGES o|--o{ CONTENT_TOPICS : stages

    CONTENT_TOPICS ||--o{ CONTENT_BRIEFS : materializes
    CHANNELS ||--o{ CONTENT_BRIEFS : adapts_for
    CONTENT_BRIEFS ||--o{ SCHEDULE_ITEMS : schedules
    CHANNELS ||--o{ SCHEDULE_ITEMS : calendars
    CONTENT_TOPICS o|--o{ CONTENT_ITEMS : informs
    CONTENT_BRIEFS o|--o{ CONTENT_ITEMS : produces
    CHANNELS ||--o{ CONTENT_ITEMS : publishes_to
    SCHEDULE_ITEMS o|--|| CONTENT_ITEMS : instantiates

    CONTENT_ITEMS ||--o{ CONTENT_ITEM_VERSIONS : versions
    CONTENT_ITEM_VERSIONS ||--o{ CONTENT_FEEDBACK_EVENTS : receives

    AI_FUNCTIONS ||--o{ PROMPT_TEMPLATES : powers
    PROMPT_TEMPLATES ||--o{ PROMPT_TEMPLATE_VERSIONS : versions
    AI_FUNCTIONS ||--o{ AI_JOBS : executes
    PROMPT_TEMPLATE_VERSIONS o|--o{ AI_JOBS : drives
    AI_JOBS o|--o{ AI_JOBS : chains
    AI_JOBS o|--o{ CONTENT_ITEM_VERSIONS : creates
    AI_JOBS ||--o{ AI_FEEDBACK_EVENTS : receives
    CONTENT_ITEMS o|--o{ AI_FEEDBACK_EVENTS : rates

    BRANDS ||--o{ LIBRARY_ASSETS : stores
    CONTENT_ITEM_VERSIONS ||--o{ CONTENT_ITEM_ASSETS : attaches
    LIBRARY_ASSETS ||--o{ CONTENT_ITEM_ASSETS : reuses

    BRANDS ||--o{ VIDEO_PROJECTS : owns
    CONTENT_ITEMS o|--|| VIDEO_PROJECTS : realizes
    CONTENT_TOPICS o|--o{ VIDEO_PROJECTS : based_on
    CONTENT_BRIEFS o|--o{ VIDEO_PROJECTS : planned_from
    VIDEO_PROJECTS ||--o{ VIDEO_SCRIPT_VERSIONS : scripts
    VIDEO_SCRIPT_VERSIONS ||--o{ VIDEO_SCENES : splits_into
    VIDEO_SCENES ||--o{ VIDEO_SCENE_ASSETS : renders
    LIBRARY_ASSETS ||--o{ VIDEO_SCENE_ASSETS : outputs

    BRANDS ||--o{ SEO_RESEARCH_RUNS : researches
    STRATEGY_CYCLES o|--o{ SEO_RESEARCH_RUNS : scopes
    PRODUCTS o|--o{ SEO_RESEARCH_RUNS : targets
    AUDIENCE_SEGMENTS o|--o{ SEO_RESEARCH_RUNS : targets
    SEO_RESEARCH_RUNS ||--o{ SEO_KEYWORDS : returns
    SEO_RESEARCH_RUNS ||--o{ CONTENT_SEO_TARGETS : enriches
    CONTENT_TOPICS o|--o{ CONTENT_SEO_TARGETS : enriches
    CONTENT_BRIEFS o|--o{ CONTENT_SEO_TARGETS : enriches
    CONTENT_ITEMS o|--o{ CONTENT_SEO_TARGETS : enriches

    CONTENT_ITEMS ||--o{ PUBLISH_JOBS : publishes
    CHANNELS ||--o{ PUBLISH_JOBS : via
    BRANDS ||--o{ TRACKING_LINKS : tracks
    CHANNELS o|--o{ TRACKING_LINKS : used_in
    CONTENT_ITEMS o|--o{ TRACKING_LINKS : measures
    CONTENT_ITEMS ||--o{ CONTENT_ITEM_METRICS : measures
    TRACKING_LINKS o|--o{ CONVERSION_EVENTS : converts
    CONTENT_ITEMS o|--o{ CONVERSION_EVENTS : influences
    CONVERSION_EVENTS ||--o{ CONTENT_ATTRIBUTIONS : allocates
    CONTENT_ITEMS ||--o{ CONTENT_ATTRIBUTIONS : credited

    BRANDS ||--o{ ANALYTICS_INSIGHTS : learns
    STRATEGY_CYCLES o|--o{ ANALYTICS_INSIGHTS : informs
    CHANNELS o|--o{ ANALYTICS_INSIGHTS : informs
    CONTENT_ITEMS o|--o{ ANALYTICS_INSIGHTS : explains
    AI_JOBS o|--o{ ANALYTICS_INSIGHTS : generates

    WORKSPACES ||--o{ USAGE_EVENTS : costs
    BRANDS o|--o{ USAGE_EVENTS : scopes
    AI_JOBS o|--o{ USAGE_EVENTS : costs
