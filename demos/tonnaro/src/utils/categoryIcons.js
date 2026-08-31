import React from 'react';
import {
  CarOutlined, CarFilled, RocketOutlined, CompassOutlined, FlagOutlined,
  EnvironmentOutlined, PushpinOutlined, AimOutlined, GlobalOutlined,
  ClusterOutlined, DeploymentUnitOutlined, BranchesOutlined, NodeIndexOutlined,
  PartitionOutlined,
  ToolOutlined, ToolFilled, BuildOutlined, BuildFilled, SettingOutlined,
  SettingFilled, ExperimentOutlined, ThunderboltOutlined, ThunderboltFilled,
  FireOutlined, FireFilled, BulbOutlined, ApiOutlined, ControlOutlined,
  InboxOutlined, ContainerOutlined, GiftOutlined, DropboxOutlined,
  GoldOutlined, TagOutlined, TagsOutlined,
  ColumnHeightOutlined, VerticalAlignTopOutlined, VerticalAlignBottomOutlined,
  CompressOutlined, ExpandOutlined, ArrowsAltOutlined, DragOutlined,
  SwapOutlined,
  ArrowUpOutlined, ArrowDownOutlined, ArrowLeftOutlined, ArrowRightOutlined,
  UpOutlined, DownOutlined, RiseOutlined, FallOutlined,
  ClockCircleOutlined, HourglassOutlined, ScheduleOutlined, CalendarOutlined,
  HistoryOutlined, FieldTimeOutlined,
  UserOutlined, TeamOutlined, CustomerServiceOutlined, SolutionOutlined,
  SafetyOutlined, SafetyCertificateOutlined, CrownOutlined, IdcardOutlined,
  CloudOutlined, CloudServerOutlined,
  ShopOutlined, BankOutlined, HomeOutlined, AppstoreOutlined,
  DollarOutlined, EuroOutlined, WalletOutlined, CreditCardOutlined,
  CheckCircleOutlined, CloseCircleOutlined, InfoCircleOutlined, WarningOutlined,
  StarOutlined, HeartOutlined,
  PhoneOutlined, MobileOutlined, MailOutlined, MessageOutlined,
  FileOutlined, FileTextOutlined, FolderOutlined, DatabaseOutlined, HddOutlined,
  LineChartOutlined, BarChartOutlined, DashboardOutlined, FundOutlined,
  TrophyOutlined, MinusOutlined,
} from '@ant-design/icons';

const ICON_DEFS = {
  // Transport & movement
  car:                { cmp: <CarOutlined />,              label: 'Car',              group: 'transport', kw: 'auto vehicle drive automobile' },
  'car-filled':       { cmp: <CarFilled />,                label: 'Car (filled)',     group: 'transport', kw: 'auto vehicle truck solid' },
  rocket:             { cmp: <RocketOutlined />,           label: 'Rocket',           group: 'transport', kw: 'fast speed express launch' },
  compass:            { cmp: <CompassOutlined />,          label: 'Compass',          group: 'transport', kw: 'direction navigate map' },
  flag:               { cmp: <FlagOutlined />,             label: 'Flag',             group: 'transport', kw: 'destination goal marker' },
  environment:        { cmp: <EnvironmentOutlined />,      label: 'Map pin',          group: 'transport', kw: 'location map pin address place' },
  pushpin:            { cmp: <PushpinOutlined />,          label: 'Pushpin',          group: 'transport', kw: 'pin marker location' },
  aim:                { cmp: <AimOutlined />,              label: 'Target',           group: 'transport', kw: 'target destination focus' },
  global:             { cmp: <GlobalOutlined />,           label: 'Globe',            group: 'transport', kw: 'world international globe' },
  cluster:            { cmp: <ClusterOutlined />,          label: 'Cluster',          group: 'transport', kw: 'fleet group network' },
  'deployment-unit':  { cmp: <DeploymentUnitOutlined />,   label: 'Fleet',            group: 'transport', kw: 'fleet deployment group' },
  branches:           { cmp: <BranchesOutlined />,         label: 'Branches',         group: 'transport', kw: 'routes paths split' },
  'node-index':       { cmp: <NodeIndexOutlined />,        label: 'Route',            group: 'transport', kw: 'route path nodes' },
  partition:          { cmp: <PartitionOutlined />,        label: 'Partition',        group: 'transport', kw: 'network split divide' },

  // Tools & construction
  tool:               { cmp: <ToolOutlined />,             label: 'Wrench',           group: 'tools', kw: 'wrench repair fix tool' },
  'tool-filled':      { cmp: <ToolFilled />,               label: 'Wrench (filled)',  group: 'tools', kw: 'wrench repair solid' },
  build:              { cmp: <BuildOutlined />,            label: 'Construction',     group: 'tools', kw: 'construction build crane' },
  'build-filled':     { cmp: <BuildFilled />,              label: 'Construction (filled)', group: 'tools', kw: 'construction crane solid' },
  setting:            { cmp: <SettingOutlined />,          label: 'Gear',             group: 'tools', kw: 'gear settings config cog' },
  'setting-filled':   { cmp: <SettingFilled />,            label: 'Gear (filled)',    group: 'tools', kw: 'gear settings solid' },
  experiment:         { cmp: <ExperimentOutlined />,       label: 'Experiment',       group: 'tools', kw: 'lab science test chemical' },
  thunderbolt:        { cmp: <ThunderboltOutlined />,      label: 'Lightning',        group: 'tools', kw: 'lightning power electric fast' },
  'thunderbolt-filled': { cmp: <ThunderboltFilled />,      label: 'Lightning (filled)', group: 'tools', kw: 'power electric solid' },
  fire:               { cmp: <FireOutlined />,             label: 'Fire',             group: 'tools', kw: 'hot urgent fire flame' },
  'fire-filled':      { cmp: <FireFilled />,               label: 'Fire (filled)',    group: 'tools', kw: 'hot fire flame solid' },
  bulb:               { cmp: <BulbOutlined />,             label: 'Bulb',             group: 'tools', kw: 'idea light bulb lamp' },
  api:                { cmp: <ApiOutlined />,              label: 'API',              group: 'tools', kw: 'api integration connect plug' },
  control:            { cmp: <ControlOutlined />,          label: 'Controls',         group: 'tools', kw: 'control panel mixer slider' },

  // Cargo & boxes
  inbox:              { cmp: <InboxOutlined />,            label: 'Inbox',            group: 'cargo', kw: 'box container inbox package' },
  container:          { cmp: <ContainerOutlined />,        label: 'Container',        group: 'cargo', kw: 'container box cargo' },
  gift:               { cmp: <GiftOutlined />,             label: 'Gift',             group: 'cargo', kw: 'gift package present' },
  dropbox:            { cmp: <DropboxOutlined />,          label: 'Dropbox',          group: 'cargo', kw: 'dropbox box' },
  gold:               { cmp: <GoldOutlined />,             label: 'Gold bar',         group: 'cargo', kw: 'gold bar bullion' },
  tag:                { cmp: <TagOutlined />,              label: 'Tag',              group: 'cargo', kw: 'tag label' },
  tags:               { cmp: <TagsOutlined />,             label: 'Tags',             group: 'cargo', kw: 'tags labels' },

  // Dimensions & movement
  'column-height':    { cmp: <ColumnHeightOutlined />,     label: 'Height',           group: 'dimensions', kw: 'height vertical tall' },
  'vertical-align-top': { cmp: <VerticalAlignTopOutlined />, label: 'Lift up',        group: 'dimensions', kw: 'top lift raise crane' },
  'vertical-align-bottom': { cmp: <VerticalAlignBottomOutlined />, label: 'Lower',    group: 'dimensions', kw: 'bottom lower drop' },
  compress:           { cmp: <CompressOutlined />,         label: 'Compress',         group: 'dimensions', kw: 'compress narrow small' },
  expand:             { cmp: <ExpandOutlined />,           label: 'Expand',           group: 'dimensions', kw: 'expand wide large' },
  'arrows-alt':       { cmp: <ArrowsAltOutlined />,        label: 'Move',             group: 'dimensions', kw: 'move arrows all directions' },
  drag:               { cmp: <DragOutlined />,             label: 'Drag',             group: 'dimensions', kw: 'drag move handle' },
  swap:               { cmp: <SwapOutlined />,             label: 'Swap',             group: 'dimensions', kw: 'swap exchange switch transfer' },

  // Arrows
  'arrow-up':         { cmp: <ArrowUpOutlined />,          label: 'Arrow up',         group: 'arrows', kw: 'up north' },
  'arrow-down':       { cmp: <ArrowDownOutlined />,        label: 'Arrow down',       group: 'arrows', kw: 'down south' },
  'arrow-left':       { cmp: <ArrowLeftOutlined />,        label: 'Arrow left',       group: 'arrows', kw: 'left west' },
  'arrow-right':      { cmp: <ArrowRightOutlined />,       label: 'Arrow right',      group: 'arrows', kw: 'right east' },
  up:                 { cmp: <UpOutlined />,               label: 'Up',               group: 'arrows', kw: 'up chevron' },
  down:               { cmp: <DownOutlined />,             label: 'Down',             group: 'arrows', kw: 'down chevron' },
  rise:               { cmp: <RiseOutlined />,             label: 'Rise',             group: 'arrows', kw: 'increase growth trend up' },
  fall:               { cmp: <FallOutlined />,             label: 'Fall',             group: 'arrows', kw: 'decrease drop trend down' },

  // Time
  'clock-circle':     { cmp: <ClockCircleOutlined />,      label: 'Clock',            group: 'time', kw: 'time clock watch' },
  hourglass:          { cmp: <HourglassOutlined />,        label: 'Hourglass',        group: 'time', kw: 'waiting pending hourglass' },
  schedule:           { cmp: <ScheduleOutlined />,         label: 'Schedule',         group: 'time', kw: 'schedule plan calendar' },
  calendar:           { cmp: <CalendarOutlined />,         label: 'Calendar',         group: 'time', kw: 'calendar date' },
  history:            { cmp: <HistoryOutlined />,          label: 'History',          group: 'time', kw: 'history log past' },
  'field-time':       { cmp: <FieldTimeOutlined />,        label: 'Duration',         group: 'time', kw: 'time duration stopwatch' },

  // People
  user:               { cmp: <UserOutlined />,             label: 'User',             group: 'people', kw: 'person user profile' },
  team:               { cmp: <TeamOutlined />,             label: 'Team',             group: 'people', kw: 'team group people' },
  'customer-service': { cmp: <CustomerServiceOutlined />,  label: 'Support',          group: 'people', kw: 'support headset call service' },
  solution:           { cmp: <SolutionOutlined />,         label: 'Worker',           group: 'people', kw: 'person document worker solution' },
  safety:             { cmp: <SafetyOutlined />,           label: 'Safety',           group: 'people', kw: 'safety shield protect' },
  'safety-certificate': { cmp: <SafetyCertificateOutlined />, label: 'Certificate',   group: 'people', kw: 'certificate verified safety licence' },
  crown:              { cmp: <CrownOutlined />,            label: 'Crown',            group: 'people', kw: 'vip premium crown' },
  idcard:             { cmp: <IdcardOutlined />,           label: 'ID card',          group: 'people', kw: 'id card identity licence' },

  // Weather / cloud
  cloud:              { cmp: <CloudOutlined />,            label: 'Cloud',            group: 'weather', kw: 'cloud sky weather' },
  'cloud-server':     { cmp: <CloudServerOutlined />,      label: 'Cloud server',     group: 'weather', kw: 'cloud server data' },

  // Business
  shop:               { cmp: <ShopOutlined />,             label: 'Shop',             group: 'business', kw: 'shop store retail' },
  bank:               { cmp: <BankOutlined />,             label: 'Bank',             group: 'business', kw: 'bank office building' },
  home:               { cmp: <HomeOutlined />,             label: 'Home',             group: 'business', kw: 'home house address' },
  appstore:           { cmp: <AppstoreOutlined />,         label: 'Apps',             group: 'business', kw: 'apps grid applications' },
  dollar:             { cmp: <DollarOutlined />,           label: 'Dollar',           group: 'business', kw: 'money dollar usd price' },
  euro:               { cmp: <EuroOutlined />,             label: 'Euro',             group: 'business', kw: 'money euro eur price' },
  wallet:             { cmp: <WalletOutlined />,           label: 'Wallet',           group: 'business', kw: 'wallet money pay' },
  'credit-card':      { cmp: <CreditCardOutlined />,       label: 'Card',             group: 'business', kw: 'credit card pay' },

  // Status
  'check-circle':     { cmp: <CheckCircleOutlined />,      label: 'Check',            group: 'status', kw: 'ok done check complete success' },
  'close-circle':     { cmp: <CloseCircleOutlined />,      label: 'Close',            group: 'status', kw: 'fail no close cancel' },
  'info-circle':      { cmp: <InfoCircleOutlined />,       label: 'Info',             group: 'status', kw: 'info information' },
  warning:            { cmp: <WarningOutlined />,          label: 'Warning',          group: 'status', kw: 'warning alert caution' },
  star:               { cmp: <StarOutlined />,             label: 'Star',             group: 'status', kw: 'favorite star rating' },
  heart:              { cmp: <HeartOutlined />,            label: 'Heart',            group: 'status', kw: 'like love heart' },

  // Communication
  phone:              { cmp: <PhoneOutlined />,            label: 'Phone',            group: 'comms', kw: 'phone call' },
  mobile:             { cmp: <MobileOutlined />,           label: 'Mobile',           group: 'comms', kw: 'mobile phone cellphone' },
  mail:               { cmp: <MailOutlined />,             label: 'Mail',             group: 'comms', kw: 'mail email' },
  message:            { cmp: <MessageOutlined />,          label: 'Message',          group: 'comms', kw: 'message chat sms' },

  // Data
  file:               { cmp: <FileOutlined />,             label: 'File',             group: 'data', kw: 'file document' },
  'file-text':        { cmp: <FileTextOutlined />,         label: 'Document',         group: 'data', kw: 'text document file invoice' },
  folder:             { cmp: <FolderOutlined />,           label: 'Folder',           group: 'data', kw: 'folder directory' },
  database:           { cmp: <DatabaseOutlined />,         label: 'Database',         group: 'data', kw: 'database storage data' },
  hdd:                { cmp: <HddOutlined />,              label: 'HDD',              group: 'data', kw: 'disk storage drive' },

  // Charts
  'line-chart':       { cmp: <LineChartOutlined />,        label: 'Line chart',       group: 'charts', kw: 'line chart graph trend' },
  'bar-chart':        { cmp: <BarChartOutlined />,         label: 'Bar chart',        group: 'charts', kw: 'bar chart graph' },
  dashboard:          { cmp: <DashboardOutlined />,        label: 'Dashboard',        group: 'charts', kw: 'dashboard gauge meter' },
  fund:               { cmp: <FundOutlined />,             label: 'Fund',             group: 'charts', kw: 'fund stock analytics' },
  trophy:             { cmp: <TrophyOutlined />,           label: 'Trophy',           group: 'charts', kw: 'trophy award winner prize' },

  // Misc
  minus:              { cmp: <MinusOutlined />,            label: 'Minus',            group: 'misc', kw: 'minus dash line' },
};

const ICON_MAP = Object.fromEntries(
  Object.entries(ICON_DEFS).map(([k, v]) => [k, v.cmp]),
);

export function getCategoryIcon(iconName) {
  return ICON_MAP[iconName] || ICON_MAP.car;
}

export function CategoryImage({ imageUrl, icon, size = 32 }) {
  if (imageUrl) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size > 40 ? 8 : 4,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <img
          src={imageUrl}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            display: 'block',
          }}
        />
      </div>
    );
  }
  return React.cloneElement(getCategoryIcon(icon), { style: { fontSize: size * 0.6 } });
}

export const AVAILABLE_ICONS = Object.keys(ICON_DEFS);

export const ICON_GROUPS = {
  transport:  'Transport',
  tools:      'Tools',
  cargo:      'Cargo',
  dimensions: 'Dimensions',
  arrows:     'Arrows',
  time:       'Time',
  people:     'People',
  weather:    'Weather',
  business:   'Business',
  status:     'Status',
  comms:      'Communication',
  data:       'Data',
  charts:     'Charts',
  misc:       'Misc',
};

export function getIconMeta(iconName) {
  return ICON_DEFS[iconName] || null;
}

export function searchIcons(query) {
  if (!query || !query.trim()) return AVAILABLE_ICONS;
  const q = query.toLowerCase().trim();
  return AVAILABLE_ICONS.filter((key) => {
    const def = ICON_DEFS[key];
    return (
      key.toLowerCase().includes(q)
      || def.label.toLowerCase().includes(q)
      || def.kw.includes(q)
      || def.group.includes(q)
    );
  });
}

export default ICON_MAP;
