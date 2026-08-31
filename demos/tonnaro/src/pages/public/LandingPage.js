import React, { useEffect, useState } from 'react';
import { Button, Row, Col, Grid } from 'antd';
import {
  EnvironmentOutlined,
  ArrowRightOutlined, AimOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useBranding } from '../../contexts/BrandingContext';
import { useLang } from '../../contexts/LanguageContext';
import LocationAutocomplete from '../../components/common/LocationAutocomplete';
import PictureImage from '../../components/common/PictureImage';
import { getCategoryIcon, CategoryImage } from '../../utils/categoryIcons';

const { useBreakpoint } = Grid;

// Same boot-data pattern BrandingContext uses: sync read from
// window.__BOOT__ (server-injected) -> localStorage (last successful API
// response) -> null. With this in place the hero copy, stats, steps, and
// benefits all paint correctly on the very first frame instead of
// flashing the translation-key fallbacks for ~300ms.
const LANDING_CACHE_KEY = 'tonnaro_landing_v1';

// Default render order + visibility for landing sections. The public page
// falls back to this when LandingPageSettings.section_order is empty (e.g.
// the singleton hasn't been touched since the migration backfilled it) AND
// it backfills any keys missing from the admin-saved order — that way a
// newly-added section appears on the page even before an admin saves the
// reorder UI again. Keys here must match the `sections` map below and the
// admin-side translation labels (adminLanding.section<Key>).
const DEFAULT_SECTION_ORDER = [
  { key: 'hero', enabled: true },
  { key: 'vehicle_types', enabled: true },
  { key: 'services', enabled: true },
  { key: 'about', enabled: true },
  { key: 'steps', enabled: true },
  { key: 'benefits', enabled: true },
  { key: 'cta', enabled: true },
];

function resolveSectionOrder(apiOrder) {
  const fromApi = Array.isArray(apiOrder) && apiOrder.length > 0 ? apiOrder : null;
  const baseOrder = fromApi || DEFAULT_SECTION_ORDER;
  const seen = new Set(baseOrder.map((s) => s.key));
  const missing = DEFAULT_SECTION_ORDER.filter((s) => !seen.has(s.key));
  return [...baseOrder, ...missing];
}

function readInitialLanding() {
  if (typeof window === 'undefined') return null;
  try {
    const boot = window.__BOOT__?.landing;
    if (boot) return boot;
  } catch {}
  try {
    const cached = window.localStorage?.getItem(LANDING_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}
  return null;
}

export default function LandingPage() {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const { t, lang } = useLang();
  const { user } = useAuth();
  const { defaultSearchScope, defaultSearchCountries, contactPhone } = useBranding();
  const [categories, setCategories] = useState([]);
  const [carCategories, setCarCategories] = useState([]);
  const [showAllServices, setShowAllServices] = useState(false);
  const [showAllCarCategories, setShowAllCarCategories] = useState(false);
  const [landing, setLanding] = useState(readInitialLanding);
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [pickupLocation, setPickupLocation] = useState(null);
  const [destinationLocation, setDestinationLocation] = useState(null);
  const [pickupCountryCode, setPickupCountryCode] = useState(null);

  useEffect(() => {
    api.get('/services/').then(({ data }) => {
      setCategories(Array.isArray(data) ? data : data.results || []);
    }).catch(() => {});
    api.get('/categories/').then(({ data }) => {
      setCarCategories(Array.isArray(data) ? data : data.results || []);
    }).catch(() => {});
    api.get('/landing/').then(({ data }) => {
      setLanding(data);
      try { window.localStorage?.setItem(LANDING_CACHE_KEY, JSON.stringify(data)); } catch {}
    }).catch(() => {});
  }, []);

  const isMobile = !screens.md;

  // Helper: get i18n text from landing data, fallback to translation key
  const lt = (field, fallbackKey) => {
    if (landing && landing[field]) {
      const val = landing[field];
      if (typeof val === 'string') return val;
      if (typeof val === 'object') return val[lang] || val['en'] || '';
    }
    return fallbackKey ? t(fallbackKey) : '';
  };

  // Derive country code filter from global site settings.
  const getSearchCountryCode = () => {
    const scope = defaultSearchScope || 'georgia';
    if (scope === 'georgia') return 'ge';
    if (scope === 'worldwide') return null;
    if (scope === 'custom') {
      const countries = defaultSearchCountries || [];
      return countries.length ? countries.join(',') : null;
    }
    return 'ge';
  };

  const searchCountryCode = getSearchCountryCode();

  const handleGetOffers = () => {
    const locationState = {
      pickup: pickupLocation ? { ...pickupLocation, text: pickup } : pickup ? { text: pickup } : null,
      destination: destinationLocation ? { ...destinationLocation, text: destination } : destination ? { text: destination } : null,
    };
    if (user) {
      navigate('/app/order/new', { state: locationState });
    } else {
      navigate('/register', { state: locationState });
    }
  };

  const handleCategoryClick = (cat) => {
    const target = `/app/order/new?service=${cat.id}`;
    if (user) {
      navigate(target);
    } else {
      // Send the user to login; LoginPage honors state.redirectTo after
      // successful login so they land back on the order flow with the
      // chosen service pre-selected.
      navigate('/login', { state: { redirectTo: target } });
    }
  };

  const handleCarCategoryClick = (cat) => {
    const target = `/app/order/new?category=${cat.id}`;
    if (user) {
      navigate(target);
    } else {
      // Mirror handleCategoryClick: send to login; LoginPage honors
      // state.redirectTo so they return to the order flow with this car
      // category pre-selected.
      navigate('/login', { state: { redirectTo: target } });
    }
  };

  // Build stats from API or fallback
  const stats = (landing?.stats && landing.stats.length > 0)
    ? landing.stats.map((s) => ({
        num: s.number,
        label: (typeof s.label === 'object') ? (s.label[lang] || s.label['en'] || '') : (s.label || ''),
      }))
    : [
        { num: '500+', label: t('landing.statsOrders') },
        { num: '50+', label: t('landing.statsVehicles') },
        { num: '98%', label: t('landing.statsRating') },
      ];

  // Build steps from API or fallback
  const steps = (landing?.steps && landing.steps.length > 0)
    ? landing.steps.map((s, i) => ({
        icon: getCategoryIcon(s.icon),
        title: (typeof s.title === 'object') ? (s.title[lang] || s.title['en'] || '') : (s.title || ''),
        desc: (typeof s.description === 'object') ? (s.description[lang] || s.description['en'] || '') : (s.description || ''),
        num: String(i + 1).padStart(2, '0'),
      }))
    : [
        { icon: getCategoryIcon('build'), title: t('landing.step1Title'), desc: t('landing.step1Desc'), num: '01' },
        { icon: getCategoryIcon('tool'), title: t('landing.step2Title'), desc: t('landing.step2Desc'), num: '02' },
        { icon: getCategoryIcon('car'), title: t('landing.step3Title'), desc: t('landing.step3Desc'), num: '03' },
      ];

  // Build benefits from API or fallback
  const benefits = (landing?.benefits && landing.benefits.length > 0)
    ? landing.benefits.map((b) => ({
        icon: getCategoryIcon(b.icon),
        title: (typeof b.title === 'object') ? (b.title[lang] || b.title['en'] || '') : (b.title || ''),
        desc: (typeof b.description === 'object') ? (b.description[lang] || b.description['en'] || '') : (b.description || ''),
        color: b.color || 'var(--accent)',
        bg: b.color ? `${b.color}1a` : 'var(--accent-bg-strong)',
      }))
    : [
        { icon: getCategoryIcon('rocket'), title: t('landing.fastTitle'), desc: t('landing.fastDesc'), color: '#F97316', bg: 'rgba(249,115,22,0.1)' },
        { icon: getCategoryIcon('build'), title: t('landing.reliableTitle'), desc: t('landing.reliableDesc'), color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
        { icon: getCategoryIcon('thunderbolt'), title: t('landing.trackingTitle'), desc: t('landing.trackingDesc'), color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
        { icon: getCategoryIcon('database'), title: t('landing.smartTitle'), desc: t('landing.smartDesc'), color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
      ];

  // ─────────────────────────────────────────────────────
  // Section JSX, keyed for admin-controlled ordering.
  // Each value is rendered (or skipped) based on
  // landing.section_order via resolveSectionOrder().
  // Keys must match DEFAULT_SECTION_ORDER + the admin
  // labels in translations.js (adminLanding.section*).
  // ─────────────────────────────────────────────────────
  const sections = {
    hero: (
      <section key="hero" style={{
        background: 'var(--bg-primary)',
        padding: isMobile ? '40px 20px 48px' : '72px 48px 80px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Subtle radial accent glow */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(ellipse at 50% 0%, var(--accent-bg) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          position: 'relative', zIndex: 1,
          maxWidth: 880, margin: '0 auto', textAlign: 'center',
          animation: 'fadeInUp 0.6s cubic-bezier(0.22,1,0.36,1)',
        }}>
          <h1 style={{
            fontSize: isMobile ? 30 : 52,
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            margin: '0 0 16px',
          }}>
            {lt('hero_title', 'landing.heroTitle')}
          </h1>

          <p style={{
            fontSize: isMobile ? 16 : 19,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            maxWidth: 580,
            margin: '0 auto 36px',
          }}>
            {lt('hero_description', 'landing.heroDesc')}
          </p>

          {/* ── Search Form Bar ── */}
          <div className="lt-hero-form" style={{
            background: 'var(--card-bg)',
            borderRadius: isMobile ? 16 : 60,
            padding: isMobile ? 12 : '6px 6px 6px 24px',
            boxShadow: 'var(--shadow-xl)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? 10 : 0,
            alignItems: isMobile ? 'stretch' : 'center',
            maxWidth: 720,
            margin: '0 auto',
            width: '100%',
            boxSizing: 'border-box',
          }}>
            <LocationAutocomplete
              prefix={<EnvironmentOutlined style={{ color: 'var(--accent)', fontSize: 16 }} />}
              placeholder={t('landing.pickupPlaceholder')}
              value={pickup}
              onChange={setPickup}
              onSelect={(loc) => {
                setPickupLocation(loc);
                setPickupCountryCode(loc.countryCode || null);
              }}
              countryCode={searchCountryCode}
            />
            {!isMobile && (
              <div style={{
                width: 1, height: 28,
                background: 'var(--border-color)', flexShrink: 0,
              }} />
            )}
            <LocationAutocomplete
              prefix={<AimOutlined style={{ color: '#10b981', fontSize: 16 }} />}
              placeholder={t('landing.destinationPlaceholder')}
              value={destination}
              onChange={setDestination}
              onSelect={(loc) => setDestinationLocation(loc)}
              countryCode={pickupCountryCode || searchCountryCode}
            />
            <Button
              type="primary"
              size="large"
              onClick={handleGetOffers}
              block={isMobile}
              style={{
                height: isMobile ? 46 : 48,
                paddingInline: isMobile ? 20 : 28,
                borderRadius: isMobile ? 12 : 40,
                fontWeight: 700,
                fontSize: 15,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {t('landing.getOffers')} <ArrowRightOutlined />
            </Button>
          </div>

          {/* ── Or call (secondary action, anchored under the form) ── */}
          {contactPhone && (
            <div style={{
              marginTop: 18, textAlign: 'center',
              fontSize: 14, color: 'var(--text-secondary)',
            }}>
              {t('landing.orCall')}{' '}
              <a
                href={`tel:${contactPhone.replace(/\s+/g, '')}`}
                style={{
                  color: 'var(--accent)', fontWeight: 700,
                  textDecoration: 'none', letterSpacing: 0.2,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                <PhoneOutlined style={{ fontSize: 14 }} />
                {contactPhone}
              </a>
            </div>
          )}

          {/* ── Trust Stats ── */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: isMobile ? 24 : 48,
            marginTop: 36,
            flexWrap: 'wrap',
          }}>
            {stats.map((s, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: 24, fontWeight: 800,
                  color: 'var(--accent)', letterSpacing: '-0.02em',
                }}>
                  {s.num}
                </div>
                <div style={{
                  fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2,
                }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    ),

    vehicle_types: carCategories.length > 0 ? (
      <section key="vehicle_types" style={{
        padding: isMobile ? '48px 20px' : '72px 48px',
        background: 'var(--bg-secondary)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: isMobile ? 32 : 48 }}>
            <p style={{
              fontSize: 13, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12,
            }}>
              {t('landing.ourFleet')}
            </p>
            <h2 style={{
              fontSize: isMobile ? 26 : 36, fontWeight: 800,
              color: 'var(--text-primary)', letterSpacing: '-0.03em',
              lineHeight: 1.2, margin: 0,
            }}>
              {t('landing.browseByCategory')}
            </h2>
          </div>

          <Row gutter={[16, 16]} justify="center">
            {(showAllCarCategories ? carCategories : carCategories.slice(0, 8)).map((cat, i) => (
              <Col xs={12} sm={8} md={6} key={cat.id}>
                <div
                  className="lt-cat-card"
                  onClick={() => handleCarCategoryClick(cat)}
                  style={{
                    animation: `fadeInUp ${0.3 + i * 0.08}s cubic-bezier(0.22,1,0.36,1)`,
                  }}
                >
                  <div
                    className="lt-cat-icon"
                    style={{
                      width: '100%', aspectRatio: '1 / 1',
                      borderRadius: 16,
                      background: cat.image_url
                        ? 'var(--image-tile-bg)'
                        : 'var(--accent-bg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: 14,
                      color: 'var(--accent)', overflow: 'hidden',
                      transition: 'transform 0.3s cubic-bezier(0.22,1,0.36,1)',
                    }}
                  >
                    {cat.image_url ? (
                      <PictureImage
                        src={cat.image_url}
                        webpSrc={cat.image_webp_url}
                        alt=""
                        style={{
                          maxWidth: '100%', maxHeight: '100%',
                          width: 'auto', height: 'auto', objectFit: 'contain',
                          display: 'block',
                        }}
                      />
                    ) : (
                      <CategoryImage icon={cat.icon} size={56} />
                    )}
                  </div>
                  <h4 style={{
                    fontSize: 15, fontWeight: 700, color: 'var(--text-primary)',
                    letterSpacing: '-0.01em', margin: '0 0 4px',
                  }}>
                    {typeof cat.name === 'object' ? (cat.name[lang] || cat.name.en || '') : cat.name}
                  </h4>
                  {cat.description && (typeof cat.description === 'object' ? (cat.description[lang] || cat.description.en) : cat.description) && (
                    <p style={{
                      fontSize: 13, color: 'var(--text-secondary)',
                      lineHeight: 1.5, margin: 0,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {typeof cat.description === 'object' ? (cat.description[lang] || cat.description.en || '') : cat.description}
                    </p>
                  )}
                </div>
              </Col>
            ))}
          </Row>
          {carCategories.length > 8 && (
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Button
                type="default"
                onClick={() => setShowAllCarCategories((v) => !v)}
                style={{
                  height: 42, padding: '0 22px', borderRadius: 12,
                  fontWeight: 600, fontSize: 14,
                  background: 'var(--card-bg)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                {showAllCarCategories
                  ? t('landing.showLess')
                  : t('landing.showMore', { count: carCategories.length - 8 })}
              </Button>
            </div>
          )}
        </div>
      </section>
    ) : null,

    services: categories.length > 0 ? (
      <section key="services" style={{
        padding: isMobile ? '48px 20px' : '72px 48px',
        background: 'var(--bg-primary)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: isMobile ? 32 : 48 }}>
            <p style={{
              fontSize: 13, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12,
            }}>
              {t('landing.vehicleTypes')}
            </p>
            <h2 style={{
              fontSize: isMobile ? 26 : 36, fontWeight: 800,
              color: 'var(--text-primary)', letterSpacing: '-0.03em',
              lineHeight: 1.2, margin: 0,
            }}>
              {t('landing.availableTypes')}
            </h2>
          </div>

          <Row gutter={[16, 16]} justify="center">
            {(showAllServices ? categories : categories.slice(0, 8)).map((cat, i) => (
              <Col xs={12} sm={8} md={6} key={cat.id}>
                <div
                  className="lt-cat-card"
                  onClick={() => handleCategoryClick(cat)}
                  style={{
                    animation: `fadeInUp ${0.3 + i * 0.08}s cubic-bezier(0.22,1,0.36,1)`,
                  }}
                >
                  <div
                    className="lt-cat-icon"
                    style={{
                      width: '100%', aspectRatio: '1 / 1',
                      borderRadius: 16,
                      background: cat.image_url
                        ? 'var(--image-tile-bg)'
                        : 'var(--accent-bg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: 14,
                      color: 'var(--accent)', overflow: 'hidden',
                      transition: 'transform 0.3s cubic-bezier(0.22,1,0.36,1)',
                    }}
                  >
                    {cat.image_url ? (
                      <PictureImage
                        src={cat.image_url}
                        webpSrc={cat.image_webp_url}
                        alt=""
                        style={{
                          maxWidth: '100%', maxHeight: '100%',
                          width: 'auto', height: 'auto', objectFit: 'contain',
                          display: 'block',
                        }}
                      />
                    ) : (
                      <CategoryImage icon={cat.icon} size={56} />
                    )}
                  </div>
                  <h4 style={{
                    fontSize: 15, fontWeight: 700, color: 'var(--text-primary)',
                    letterSpacing: '-0.01em', margin: '0 0 4px',
                  }}>
                    {typeof cat.name === 'object' ? (cat.name[lang] || cat.name.en || '') : cat.name}
                  </h4>
                  {cat.description && (typeof cat.description === 'object' ? (cat.description[lang] || cat.description.en) : cat.description) && (
                    <p style={{
                      fontSize: 13, color: 'var(--text-secondary)',
                      lineHeight: 1.5, margin: 0,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {typeof cat.description === 'object' ? (cat.description[lang] || cat.description.en || '') : cat.description}
                    </p>
                  )}
                </div>
              </Col>
            ))}
          </Row>
          {categories.length > 8 && (
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Button
                type="default"
                onClick={() => setShowAllServices((v) => !v)}
                style={{
                  height: 42, padding: '0 22px', borderRadius: 12,
                  fontWeight: 600, fontSize: 14,
                  background: 'var(--card-bg)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                {showAllServices
                  ? t('landing.showLess')
                  : t('landing.showMore', { count: categories.length - 8 })}
              </Button>
            </div>
          )}
        </div>
      </section>
    ) : null,

    about: (
      <section key="about" style={{
        padding: isMobile ? '56px 20px' : '88px 48px',
        background: 'var(--bg-secondary)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Row gutter={[isMobile ? 32 : 56, 32]} align="middle">
            <Col xs={24} md={12}>
              <p style={{
                fontSize: 13, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12,
              }}>
                {lt('about_eyebrow', 'landing.aboutUs')}
              </p>
              <h2 style={{
                fontSize: isMobile ? 26 : 36, fontWeight: 800,
                color: 'var(--text-primary)', letterSpacing: '-0.03em',
                lineHeight: 1.2, margin: '0 0 20px',
              }}>
                {lt('about_title', 'landing.aboutTitle')}
              </h2>
              <p style={{
                fontSize: isMobile ? 15 : 16,
                color: 'var(--text-secondary)',
                lineHeight: 1.7, margin: 0,
                whiteSpace: 'pre-line',
              }}>
                {lt('about_description', 'landing.aboutDesc')}
              </p>
            </Col>
            <Col xs={24} md={12}>
              <div style={{
                width: '100%', aspectRatio: '4 / 3',
                borderRadius: 20, overflow: 'hidden',
                background: landing?.about_image_url
                  ? 'var(--image-tile-bg)'
                  : 'linear-gradient(135deg, var(--accent-bg) 0%, var(--bg-primary) 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 12px 32px rgba(0,0,0,0.08)',
              }}>
                {landing?.about_image_url ? (
                  <PictureImage
                    src={landing.about_image_url}
                    webpSrc={landing.about_image_webp_url}
                    alt=""
                    style={{
                      width: '100%', height: '100%', objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                ) : (
                  <CategoryImage icon="build" size={isMobile ? 64 : 96} />
                )}
              </div>
            </Col>
          </Row>
        </div>
      </section>
    ),

    steps: steps.length > 0 ? (
      <section key="steps" style={{
        padding: isMobile ? '56px 20px' : '88px 48px',
        background: 'var(--bg-primary)',
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: isMobile ? 36 : 56 }}>
            <p style={{
              fontSize: 13, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12,
            }}>
              {lt('steps_title', 'landing.howItWorks') || t('landing.howItWorks')}
            </p>
            <h2 style={{
              fontSize: isMobile ? 26 : 36, fontWeight: 800,
              color: 'var(--text-primary)', letterSpacing: '-0.03em',
              lineHeight: 1.2, margin: 0,
            }}>
              {lt('steps_title', 'landing.howItWorks') || t('landing.howItWorks')}
            </h2>
          </div>

          <Row gutter={[24, 24]}>
            {steps.map((step, i) => (
              <Col xs={24} md={8} key={i}>
                <div
                  className="lt-step-card"
                  style={{
                    animation: `fadeInUp ${0.4 + i * 0.12}s cubic-bezier(0.22,1,0.36,1)`,
                  }}
                >
                  <div style={{
                    width: 56, height: 56, borderRadius: 16,
                    background: 'var(--accent-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 20px', color: 'var(--accent)', fontSize: 28,
                  }}>
                    {step.icon}
                  </div>
                  <div style={{
                    fontSize: 12, fontWeight: 700, color: 'var(--accent)',
                    letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10,
                  }}>
                    {step.num}
                  </div>
                  <h4 style={{
                    fontSize: 18, fontWeight: 700, color: 'var(--text-primary)',
                    letterSpacing: '-0.02em', margin: '0 0 8px',
                  }}>
                    {step.title}
                  </h4>
                  <p style={{
                    fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0,
                  }}>
                    {step.desc}
                  </p>
                </div>
              </Col>
            ))}
          </Row>
        </div>
      </section>
    ) : null,

    benefits: benefits.length > 0 ? (
      <section key="benefits" style={{
        padding: isMobile ? '56px 20px' : '88px 48px',
        background: 'var(--bg-secondary)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: isMobile ? 36 : 56 }}>
            <p style={{
              fontSize: 13, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12,
            }}>
              {lt('benefits_title', 'landing.whyChoose') || t('landing.whyChoose')}
            </p>
            <h2 style={{
              fontSize: isMobile ? 26 : 36, fontWeight: 800,
              color: 'var(--text-primary)', letterSpacing: '-0.03em',
              lineHeight: 1.2, margin: 0,
            }}>
              {lt('benefits_title', 'landing.whyChoose') || t('landing.whyChoose')}
            </h2>
          </div>

          <Row gutter={[20, 20]}>
            {benefits.map((b, i) => (
              <Col xs={24} sm={12} key={i}>
                <div
                  className="lt-benefit-card"
                  style={{
                    display: 'flex', gap: 18, alignItems: 'flex-start',
                    animation: `fadeInUp ${0.4 + i * 0.1}s cubic-bezier(0.22,1,0.36,1)`,
                  }}
                >
                  <div style={{
                    width: 48, height: 48, minWidth: 48, borderRadius: 14,
                    background: b.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: b.color, fontSize: 22,
                  }}>
                    {b.icon}
                  </div>
                  <div>
                    <h4 style={{
                      fontSize: 16, fontWeight: 700, color: 'var(--text-primary)',
                      letterSpacing: '-0.02em', margin: '0 0 6px',
                    }}>
                      {b.title}
                    </h4>
                    <p style={{
                      fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0,
                    }}>
                      {b.desc}
                    </p>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </div>
      </section>
    ) : null,

    cta: (
      <section key="cta" style={{
        background: 'var(--header-gradient)',
        padding: isMobile ? '64px 20px' : '88px 48px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative orbs */}
        <div style={{
          position: 'absolute', top: '-30%', left: '-10%',
          width: 300, height: 300, borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)', filter: 'blur(50px)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-20%', right: '-5%',
          width: 250, height: 250, borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)', filter: 'blur(40px)',
          pointerEvents: 'none',
        }} />

        <div style={{
          position: 'relative', zIndex: 1,
          maxWidth: 600, margin: '0 auto',
        }}>
          <h2 style={{
            color: '#fff',
            fontSize: isMobile ? 26 : 36,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.2,
            margin: '0 0 14px',
          }}>
            {lt('cta_title', 'landing.readyTitle')}
          </h2>
          <p style={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: isMobile ? 15 : 18,
            lineHeight: 1.6,
            margin: '0 0 36px',
          }}>
            {lt('cta_description', 'landing.readyDesc')}
          </p>
          <Button
            size="large"
            className="lt-cta-btn"
            onClick={() => navigate(user ? '/app/order/new' : '/register')}
            style={{
              height: 52,
              paddingInline: 40,
              fontSize: 16,
              borderRadius: 12,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {lt('cta_button_text', 'landing.getStarted')} <ArrowRightOutlined />
          </Button>
        </div>
      </section>
    ),
  };

  const orderedSections = resolveSectionOrder(landing?.section_order)
    .filter(({ enabled, key }) => enabled && sections[key])
    .map(({ key }) => sections[key]);

  return (
    <div>
      {/* ── Scoped styles ── */}
      <style>{`
        .lt-hero-form .ant-input,
        .lt-hero-form .ant-input-affix-wrapper {
          border: none !important;
          box-shadow: none !important;
          background: transparent !important;
        }
        .lt-hero-form .ant-input:focus,
        .lt-hero-form .ant-input-affix-wrapper:focus,
        .lt-hero-form .ant-input-affix-wrapper-focused {
          box-shadow: none !important;
        }
        .lt-cat-card {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 24px 20px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.22,1,0.36,1);
          height: 100%;
        }
        .lt-cat-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--card-hover-shadow);
          border-color: var(--accent);
        }
        .lt-cat-card:hover .lt-cat-icon {
          transform: scale(1.1);
        }
        .lt-step-card {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 32px 24px;
          text-align: center;
          height: 100%;
          transition: all 0.3s cubic-bezier(0.22,1,0.36,1);
        }
        .lt-step-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--card-hover-shadow);
          border-color: var(--accent);
        }
        .lt-benefit-card {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 28px 24px;
          height: 100%;
          transition: all 0.3s cubic-bezier(0.22,1,0.36,1);
        }
        .lt-benefit-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--card-hover-shadow);
        }
        .lt-cta-btn {
          background: #fff !important;
          border: 2px solid #fff !important;
          color: var(--accent-dark, #008F44) !important;
          font-weight: 700 !important;
          transition: all 0.25s cubic-bezier(0.22,1,0.36,1) !important;
        }
        .lt-cta-btn:hover {
          background: rgba(255,255,255,0.9) !important;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        }
      `}</style>

      {orderedSections}
    </div>
  );
}
