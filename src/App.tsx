import React, { useState, useEffect } from 'react';
import { Navbar } from './components/common/Navbar';
import { LandingPage } from './components/landing/LandingPage';
import { StreamerDashboard } from './components/dashboard/StreamerDashboard';
import { AccessDeniedPaywall } from './components/monetization/AccessDeniedPaywall';
import { AuthModal } from './components/modals/AuthModal';
import { ClipPacksModal } from './components/modals/ClipPacksModal';
import { QuickClickBotGuide } from './components/modals/QuickClickBotGuide';
import { TwoFactorAuthModal } from './components/modals/TwoFactorAuthModal';
import { ChannelSetupWizard } from './components/modals/ChannelSetupWizard';
import { SystemConfigurationHub } from './components/modals/SystemConfigurationHub';
import { StripeCheckoutModal } from './components/modals/StripeCheckoutModal';
import { ImpressumModal } from './components/legal/ImpressumModal';
import { PrivacyPolicyModal } from './components/legal/PrivacyPolicyModal';
import { TermsAndConditionsModal } from './components/legal/TermsAndConditionsModal';
import { CookieConsentBanner } from './components/legal/CookieConsentBanner';
import { AvvAgreementModal } from './components/legal/AvvAgreementModal';
import { GdprPrivacyAuditModal } from './components/modals/GdprPrivacyAuditModal';
import { StreamerUser, SubscriptionPlan, ClipPackage, ModularSubscriptionConfig } from './types/pipeline';
import {
  syncUserToFirestore,
  subscribeToUserDocument,
  logOutFirebase,
  subscribeToAuthState,
  loadUserFromFirestore,
} from './lib/firebase';
import { createRealStreamerUserFromTwitchHelix, authenticateWithTwitch } from './lib/firebaseAuth';
import {
  parseTwitchHashParams,
  parseTwitchAuthCode,
  cleanUrlHash,
  fetchTwitchCurrentUser,
  fetchTwitchStreamLiveStatus,
} from './lib/twitchApi';
import { apiClient } from './lib/apiClient';
import { PRESET_MODULAR_PLANS, BASIC_TRIAL_PLAN, FREE_STARTER_PLAN } from './utils/pricingCalculator';
import {
  ShieldCheck,
  CheckCircle2,
  Scale,
  FileCheck,
  Cookie,
  LayoutDashboard,
  ArrowRight,
  Tv,
  Activity,
  Terminal,
  Cpu,
  Sparkles,
  Zap,
  Lock,
  Compass,
  Settings,
  User,
  Film,
  Layers,
} from 'lucide-react';

const MASTER_ADMIN_EMAIL = 'robert.f.telekom@gmail.com';
const TITAN_LIFETIME_EMAILS = ['sh00trs.tv@gmail.com', 'twoandahalfeafc@gmail.com'];


export default function App() {
  const [currentUser, setCurrentUser] = useState<StreamerUser | null>(null);
  const [currentView, setCurrentView] = useState<'landing' | 'dashboard'>('landing');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [preferredPlanForAuth, setPreferredPlanForAuth] = useState<SubscriptionPlan | undefined>(undefined);
  const [initialChannelForAuth, setInitialChannelForAuth] = useState<string | undefined>(undefined);
  const [isClipPacksModalOpen, setIsClipPacksModalOpen] = useState<boolean>(false);
  const [is2FAModalOpen, setIs2FAModalOpen] = useState<boolean>(false);
  const [isChannelSetupOpen, setIsChannelSetupOpen] = useState<boolean>(false);
  const [isConfigHubModalOpen, setIsConfigHubModalOpen] = useState<boolean>(false);
  const [oauthSuccessNotice, setOauthSuccessNotice] = useState<string | null>(null);

  // Legal & GDPR Compliance Modals (German & EU Law)
  const [isImpressumOpen, setIsImpressumOpen] = useState<boolean>(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState<boolean>(false);
  const [isTermsOpen, setIsTermsOpen] = useState<boolean>(false);
  const [isAvvOpen, setIsAvvOpen] = useState<boolean>(false);
  const [isGdprAuditOpen, setIsGdprAuditOpen] = useState<boolean>(false);
  const [forceCookieBanner, setForceCookieBanner] = useState<boolean>(false);

  // Stripe Checkout state
  const [isStripeModalOpen, setIsStripeModalOpen] = useState<boolean>(false);
  const [stripePlan, setStripePlan] = useState<ModularSubscriptionConfig | null>(null);
  const [stripeClipPack, setStripeClipPack] = useState<ClipPackage | null>(null);
  const [stripeBillingCycle, setStripeBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [isTrialCheckout, setIsTrialCheckout] = useState<boolean>(false);

  // Auto-Assign Roles & Privileges (Master Admin & Titan VIPs)
  const applyVipAndAdminPrivileges = (user: StreamerUser): StreamerUser => {
    const email = (user.email || '').trim().toLowerCase();
    const isAdmin = email === MASTER_ADMIN_EMAIL.toLowerCase();
    const isTitan = TITAN_LIFETIME_EMAILS.some((e) => e.toLowerCase() === email);

    if (isAdmin) {
      return {
        ...user,
        role: 'admin',
        isAdmin: true,
        isTitanVip: true,
        hasActiveSubscription: true,
        plan: 'elite',
        clipsLimitTotal: 9999,
        apiCallsLimit: 99999,
      };
    }
    if (isTitan) {
      return {
        ...user,
        role: 'streamer',
        isTitanVip: true,
        hasActiveSubscription: true,
        plan: 'elite',
        clipsLimitTotal: 600,
        apiCallsLimit: 4800,
      };
    }
    return user;
  };

  // Process real Twitch OAuth access token and create/login streamer
  const handleTwitchAccessToken = async (token: string) => {
    try {
      const helixUser = await fetchTwitchCurrentUser(token);
      if (helixUser) {
        const stream = await fetchTwitchStreamLiveStatus(helixUser.id, token);
        let realUser = await createRealStreamerUserFromTwitchHelix(
          helixUser,
          token,
          'pro',
          undefined,
          stream
        );
        realUser = applyVipAndAdminPrivileges(realUser);
        setCurrentUser(realUser);
        const intendedView = (sessionStorage.getItem('quickclick_redirect_intent') as 'landing' | 'dashboard') || 'dashboard';
        sessionStorage.removeItem('quickclick_redirect_intent');
        setCurrentView(intendedView);
        localStorage.setItem('quickclick_user', JSON.stringify(realUser));
        await syncUserToFirestore(realUser);
        setIsAuthModalOpen(false);
        setOauthSuccessNotice(`🎉 Erfolgreich mit echtem Twitch-Account "${helixUser.display_name}" verbunden!`);
        setTimeout(() => setOauthSuccessNotice(null), 6000);
      }
    } catch (err) {
      console.error('Twitch OAuth login error:', err);
    }
  };

  // Process Twitch OAuth authorization code via secure Cloud Run backend (Zero Client Tokens)
  const handleTwitchAuthCode = async (code: string) => {
    try {
      const redirectUri = `${window.location.origin}/auth/callback/twitch`;
      const res = await apiClient<{ success: boolean; accountName: string }>('/platforms/callback/twitch', {
        method: 'POST',
        body: JSON.stringify({ code, redirectUri }),
      });
      if (res && res.success) {
        setOauthSuccessNotice(`🎉 Erfolgreich mit echtem Twitch-Account "${res.accountName}" verknüpft!`);
        setTimeout(() => setOauthSuccessNotice(null), 6000);
        if (currentUser) {
          const updated = { ...currentUser, channelName: res.accountName, isFullyConfigured: true };
          setCurrentUser(updated);
          localStorage.setItem('quickclick_user', JSON.stringify(updated));
          syncUserToFirestore(updated);
        }
      }
    } catch (err) {
      console.error('Twitch OAuth Backend Exchange error:', err);
    }
  };

  // Real Twitch OAuth Hash & Code Handler, Popup Listener & LocalStorage Session Restoration
  useEffect(() => {
    const handleAuthInit = async () => {
      // 1. Check if returning from Twitch OAuth authorization code flow (?code=...)
      const { code } = parseTwitchAuthCode();
      if (code) {
        cleanUrlHash();
        if (window.opener) {
          try {
            window.opener.postMessage({ type: 'TWITCH_AUTH_CODE', code }, '*');
            setTimeout(() => { try { window.close(); } catch (e) {} }, 500);
            return;
          } catch (e) {
            console.warn('Failed to message opener window:', e);
          }
        }
        await handleTwitchAuthCode(code);
        return;
      }

      // Check if returning from Twitch OAuth 2.0 redirect (#access_token=...)
      const { accessToken } = parseTwitchHashParams();
      if (accessToken) {
        cleanUrlHash();
        // If opened in a popup, message opener and close popup
        if (window.opener) {
          try {
            window.opener.postMessage(
              {
                type: 'TWITCH_OAUTH_SUCCESS',
                accessToken,
              },
              '*'
            );
            setTimeout(() => {
              try { window.close(); } catch (e) {}
            }, 500);
            return;
          } catch (e) {
            console.warn('Failed to message opener window:', e);
          }
        }
        await handleTwitchAccessToken(accessToken);
        return;
      }

      // 2. Restore session from localStorage if user previously logged in
      try {
        const savedUser = localStorage.getItem('quickclick_user') || localStorage.getItem('qlipzync_user');
        if (savedUser) {
          let parsed: StreamerUser = JSON.parse(savedUser);
          parsed = applyVipAndAdminPrivileges(parsed);

          // Auto-check if 14-day trial expired and needs transition to paid Basic
          if (parsed.trialActive && parsed.trialEndsAt && !parsed.trialCancelled && !parsed.trialConvertedToPaid) {
            if (new Date(parsed.trialEndsAt).getTime() <= Date.now()) {
              parsed.trialActive = false;
              parsed.trialConvertedToPaid = true;
              parsed.hasActiveSubscription = true;
              parsed.plan = 'pro';
              parsed.clipsLimitTotal = 90;
              parsed.apiCallsLimit = 900;
              parsed.modularConfig = BASIC_TRIAL_PLAN;
            }
          }
          setCurrentUser(parsed);
          syncUserToFirestore(parsed);
          if (!sessionStorage.getItem('quickclick_explicit_logout')) {
            setCurrentView('dashboard');
          }
        }
      } catch {
        // ignore
      }
    };

    handleAuthInit();

    // Listen for Twitch OAuth completion messages from popup (code or token)
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'TWITCH_AUTH_CODE' && event.data?.code) {
        handleTwitchAuthCode(event.data.code);
      } else if (event.data?.type === 'TWITCH_OAUTH_SUCCESS' && event.data?.accessToken) {
        handleTwitchAccessToken(event.data.accessToken);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Deep-linking for Legal Pages & Modals: Privacy Policy (Datenschutz), Terms (AGB), Impressum, AVV, GDPR Audit
  useEffect(() => {
    const handleUrlRoutes = () => {
      const hash = (window.location.hash || '').toLowerCase();
      const search = (window.location.search || '').toLowerCase();
      const pathname = (window.location.pathname || '').toLowerCase();

      if (
        hash.includes('privacy') ||
        hash.includes('datenschutz') ||
        search.includes('privacy') ||
        search.includes('datenschutz') ||
        pathname === '/privacy' ||
        pathname === '/datenschutz'
      ) {
        setIsPrivacyOpen(true);
      } else if (
        hash.includes('terms') ||
        hash.includes('agb') ||
        hash.includes('nutzungsbedingungen') ||
        search.includes('terms') ||
        search.includes('agb') ||
        pathname === '/terms' ||
        pathname === '/agb' ||
        pathname === '/nutzungsbedingungen'
      ) {
        setIsTermsOpen(true);
      } else if (
        hash.includes('impressum') ||
        search.includes('impressum') ||
        pathname === '/impressum'
      ) {
        setIsImpressumOpen(true);
      } else if (
        hash.includes('avv') ||
        search.includes('avv') ||
        pathname === '/avv'
      ) {
        setIsAvvOpen(true);
      } else if (
        hash.includes('audit') ||
        search.includes('audit')
      ) {
        setIsGdprAuditOpen(true);
      }
    };

    handleUrlRoutes();
    window.addEventListener('hashchange', handleUrlRoutes);
    window.addEventListener('popstate', handleUrlRoutes);
    return () => {
      window.removeEventListener('hashchange', handleUrlRoutes);
      window.removeEventListener('popstate', handleUrlRoutes);
    };
  }, []);

  const clearModalHash = () => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const h = window.location.hash.toLowerCase();
      if (
        h.includes('privacy') ||
        h.includes('datenschutz') ||
        h.includes('terms') ||
        h.includes('agb') ||
        h.includes('impressum') ||
        h.includes('avv') ||
        h.includes('audit')
      ) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  };

  // Listen for remote updates from Firestore if user is logged in
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsubscribe = subscribeToUserDocument(currentUser.id, (remoteData: Partial<StreamerUser> | null) => {
      if (remoteData) {
        setCurrentUser((prev: StreamerUser | null) => {
          if (!prev) return null;
          const merged = { ...prev, ...remoteData } as StreamerUser;
          return applyVipAndAdminPrivileges(merged);
        });
      }
    });
    return () => unsubscribe();
  }, [currentUser?.id]);

  // Real-time Firebase Auth session hydration
  useEffect(() => {
    const unsubAuth = subscribeToAuthState(async (fbUser: any) => {
      if (fbUser && !sessionStorage.getItem('quickclick_explicit_logout')) {
        const firestoreData = await loadUserFromFirestore(fbUser.uid);
        if (firestoreData && firestoreData.id) {
          setCurrentUser((prev: StreamerUser | null) => {
            let merged = { ...(prev || {}), ...firestoreData } as StreamerUser;
            merged = applyVipAndAdminPrivileges(merged);
            localStorage.setItem('quickclick_user', JSON.stringify(merged));
            return merged;
          });
          if (!sessionStorage.getItem('quickclick_explicit_logout')) {
            setCurrentView('dashboard');
          }
        }
      }
    });
    return () => unsubAuth();
  }, []);

  const handleLoginSuccess = (user: StreamerUser, isNewRegistration?: boolean) => {
    sessionStorage.removeItem('quickclick_explicit_logout');
    const verifiedUser = applyVipAndAdminPrivileges(user);
    localStorage.setItem('quickclick_user', JSON.stringify(verifiedUser));
    setCurrentUser(verifiedUser);

    // Automatically redirect back to the intended view (preserving dashboard intent)
    const intendedView = (sessionStorage.getItem('quickclick_redirect_intent') as 'landing' | 'dashboard') || 'dashboard';
    sessionStorage.removeItem('quickclick_redirect_intent');
    setCurrentView(intendedView);

    setIsAuthModalOpen(false);
    syncUserToFirestore(verifiedUser);
    if (isNewRegistration || !verifiedUser.isFullyConfigured) {
      sessionStorage.setItem('quickclick_auto_open_config', 'true');
    }
  };

  const handleLogout = async () => {
    sessionStorage.setItem('quickclick_explicit_logout', 'true');
    localStorage.removeItem('quickclick_user');
    localStorage.removeItem('qlipzync_user');
    try {
      await logOutFirebase();
    } catch (e) {
      console.warn('Firebase logout warning:', e);
    }
    setCurrentUser(null);
    setCurrentView('landing');
  };

  const handleGoToDashboard = () => {
    sessionStorage.removeItem('quickclick_explicit_logout');
    if (currentUser) {
      // Ensure user has at least free subscription access so the dashboard opens smoothly
      if (!currentUser.hasActiveSubscription || currentUser.plan === 'none') {
        const freeUser: StreamerUser = {
          ...currentUser,
          hasActiveSubscription: true,
          plan: 'free',
          clipsLimitTotal: 100,
          clipsUsedThisMonth: 0,
          bonusClips: 0,
          modularConfig: FREE_STARTER_PLAN,
        };
        handleUpdateUser(freeUser);
      }
      setCurrentView('dashboard');
    } else {
      // Preserve user intent so they are automatically redirected to dashboard upon login
      sessionStorage.setItem('quickclick_redirect_intent', 'dashboard');
      // 1. Dashboard opens directly without a logged-in account
      setCurrentView('dashboard');
      // 2. Display login modal immediately upon navigation (zero delay)
      setIsAuthModalOpen(true);
    }
  };

  const handleGoToLanding = () => {
    setCurrentView('landing');
  };

  const handleUpdateUser = (updatedUser: StreamerUser) => {
    const verified = applyVipAndAdminPrivileges(updatedUser);
    localStorage.setItem('quickclick_user', JSON.stringify(verified));
    setCurrentUser(verified);
    syncUserToFirestore(verified);
  };

  const handleOpenStripeSubscription = (
    planId: SubscriptionPlan,
    cycle: 'monthly' | 'annual' = 'annual',
    customConfig?: ModularSubscriptionConfig
  ) => {
    if (planId === 'free') {
      if (currentUser) {
        const freeUser: StreamerUser = {
          ...currentUser,
          hasActiveSubscription: true,
          plan: 'free',
          clipsLimitTotal: 30,
          clipsUsedThisMonth: 0,
          bonusClips: 0,
          modularConfig: FREE_STARTER_PLAN,
        };
        handleUpdateUser(freeUser);
      }
      return;
    }

    let matchedPlan: ModularSubscriptionConfig;
    if (customConfig) {
      matchedPlan = customConfig;
    } else {
      const tierIdx =
        planId === 'elite' ? 4 : planId === 'pro' ? 2 : planId === 'basic' ? 1 : planId === 'starter' ? 0 : 2;
      matchedPlan = PRESET_MODULAR_PLANS[tierIdx] || PRESET_MODULAR_PLANS[2];
    }
    setStripePlan(matchedPlan);
    setStripeClipPack(null);
    setStripeBillingCycle(cycle);
    setIsTrialCheckout(Boolean(matchedPlan.tierName?.includes('Testphase') || matchedPlan.description?.includes('14 Tage')));
    setIsStripeModalOpen(true);
  };

  const handleActivateSubscription = (
    plan: SubscriptionPlan = 'pro',
    cycle: 'monthly' | 'annual' = 'annual',
    customConfig?: ModularSubscriptionConfig
  ) => {
    handleOpenStripeSubscription(plan, cycle, customConfig);
  };

  const handleUpgradePlan = (
    plan: SubscriptionPlan = 'pro',
    cycle: 'monthly' | 'annual' = 'annual',
    customConfig?: ModularSubscriptionConfig
  ) => {
    handleOpenStripeSubscription(plan, cycle, customConfig);
  };

  const handleStartTrial = () => {
    if (!currentUser) {
      setPreferredPlanForAuth('pro');
      setIsAuthModalOpen(true);
      return;
    }
    setStripePlan(BASIC_TRIAL_PLAN);
    setStripeClipPack(null);
    setStripeBillingCycle('monthly');
    setIsTrialCheckout(true);
    setIsStripeModalOpen(true);
  };

  const handleBuyClipPackage = (pkg: ClipPackage) => {
    setStripePlan(null);
    setStripeClipPack(pkg);
    setIsStripeModalOpen(true);
    setIsClipPacksModalOpen(false);
  };

  const handleStartLivePreview = async (channelName: string) => {
    try {
      const previewUser: StreamerUser = {
        id: `preview_${channelName}`,
        name: channelName,
        displayName: channelName,
        channelName: channelName,
        email: `${channelName}@streamer.quickclick.com`,
        avatarUrl: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=120&auto=format&fit=crop&q=80',
        role: 'streamer',
        hasActiveSubscription: true,
        plan: 'elite',
        clipsLimitTotal: 600,
        apiCallsLimit: 4800,
      };
      handleLoginSuccess(previewUser);
      setOauthSuccessNotice(`✨ Live-Vorschau von QuickClick für @${channelName} erfolgreich gestartet!`);
      setTimeout(() => setOauthSuccessNotice(null), 5000);
    } catch (err) {
      console.error('Error launching preview:', err);
    }
  };

  const scrollToSection = (sectionId: string) => {
    if (currentUser && currentUser.hasActiveSubscription) {
      return;
    }
    const elem = document.getElementById(sectionId);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <main
      id="main-content"
      className="ui-shell bg-[#070514] text-zinc-100 font-sans selection:bg-purple-500/30 selection:text-purple-200 relative"
    >
      {/* 1. Werkzeugleiste / Steuerung (Nav) */}
      <Navbar
        currentUser={currentUser}
        currentView={currentView}
        onOpenAuth={() => {
          setPreferredPlanForAuth(undefined);
          setIsAuthModalOpen(true);
        }}
        onLogout={handleLogout}
        onScrollTo={(sectionId) => {
          if (currentView === 'dashboard') {
            setCurrentView('landing');
            setTimeout(() => scrollToSection(sectionId), 80);
          } else {
            scrollToSection(sectionId);
          }
        }}
        onGoToDashboard={handleGoToDashboard}
        onGoToLanding={handleGoToLanding}
      />

      {/* 2. Seitenleiste / Navigation (Sidebar Controls) */}
      <aside
        aria-label="Sidebar Navigation"
        className="sidebar-controls border-r border-purple-500/20 bg-[#090518]/90 backdrop-blur-md p-4 flex flex-col justify-between overflow-y-auto text-xs"
      >
        <div className="space-y-6">
          {/* View Switcher */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-400">
              Ansicht
            </span>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={handleGoToLanding}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  currentView === 'landing'
                    ? 'bg-purple-600/30 border border-purple-500/40 text-white shadow-md shadow-purple-600/10'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                <Compass className="h-4 w-4 text-purple-400" />
                <span>Startseite</span>
              </button>
              <button
                type="button"
                onClick={handleGoToDashboard}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  currentView === 'dashboard'
                    ? 'bg-fuchsia-600/30 border border-fuchsia-500/40 text-white shadow-md shadow-fuchsia-600/10'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <LayoutDashboard className="h-4 w-4 text-fuchsia-400" />
                  <span>Dashboard</span>
                </div>
                {currentUser?.hasActiveSubscription && (
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>
            </div>
          </div>

          {/* Quick Section Navigation */}
          {currentView === 'landing' && (
            <div className="space-y-2 pt-2 border-t border-purple-500/15">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                Direkt-Sprung
              </span>
              <nav aria-label="Landing Navigation" className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => scrollToSection('hero')}
                  className="text-left px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-purple-500/10 transition cursor-pointer"
                >
                  • Übersicht & Start
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('features')}
                  className="text-left px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-purple-500/10 transition cursor-pointer"
                >
                  • Autopilot-Funktionen
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('proof')}
                  className="text-left px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-purple-500/10 transition cursor-pointer"
                >
                  • Live-Pipeline Animation
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('pricing')}
                  className="text-left px-2.5 py-1.5 rounded-lg text-emerald-400 font-semibold hover:bg-emerald-500/10 transition cursor-pointer"
                >
                  • Dynamische Tarife (Stripe)
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('trust')}
                  className="text-left px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-purple-500/10 transition cursor-pointer"
                >
                  • DSGVO & Sicherheit
                </button>
              </nav>
            </div>
          )}

          {/* Quick Actions */}
          <div className="space-y-2 pt-2 border-t border-purple-500/15">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
              Schnell-Aktionen
            </span>
            <div className="flex flex-col gap-1.5">
              {!currentUser ? (
                <button
                  type="button"
                  onClick={() => {
                    setPreferredPlanForAuth('free');
                    setIsAuthModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs hover:from-purple-500 hover:to-indigo-500 transition cursor-pointer"
                >
                  <Zap className="h-3.5 w-3.5 text-yellow-300 shrink-0" />
                  <span>Kostenlos starten (0 €)</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setIsChannelSetupOpen(true)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-purple-500/10 transition cursor-pointer flex items-center gap-2"
                  >
                    <Settings className="h-3.5 w-3.5 text-purple-400" />
                    <span>Kanal konfigurieren</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIs2FAModalOpen(true)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-purple-500/10 transition cursor-pointer flex items-center gap-2"
                  >
                    <Lock className="h-3.5 w-3.5 text-emerald-400" />
                    <span>2FA Sicherheit</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Power-User Keyboard Shortcuts Legend */}
        <div className="pt-4 border-t border-purple-500/15 space-y-1.5 text-[11px] text-zinc-400 font-mono">
          <div className="text-zinc-400 font-bold uppercase text-[9px]">Tastatur-Kürzel</div>
          <div className="flex items-center justify-between">
            <span>Suche / Fokus</span>
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700 text-[10px]">
              /
            </kbd>
          </div>
          <div className="flex items-center justify-between">
            <span>Modals schließen</span>
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700 text-[10px]">
              Esc
            </kbd>
          </div>
        </div>
      </aside>

      {/* 3. Arbeitsbereich / Hauptinhalt (Workspace) */}
      <section
        id="workspace"
        tabIndex={0}
        className="relative w-full overflow-y-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 isolate scroll-smooth"
      >
        {/* Synchronized Purple Wave-Glow Background System */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(rgba(145,70,255,0.07)_1px,transparent_1px)] bg-[size:32px_32px] opacity-70" />
          <div className="absolute -top-28 -right-20 h-[580px] w-[860px] rounded-[45%_55%_65%_35%/50%_45%_55%_50%] bg-gradient-to-tr from-purple-700/25 via-[#9146FF]/30 to-fuchsia-600/25 blur-3xl opacity-70 animate-wave-glow" />
          <div className="absolute top-[30%] -left-40 h-[640px] w-[900px] rounded-[55%_45%_40%_60%/45%_60%_40%_55%] bg-gradient-to-br from-indigo-700/20 via-violet-600/25 to-purple-500/20 blur-3xl opacity-60 animate-wave-glow-reverse" />
          <div className="absolute top-[65%] -right-32 h-[480px] w-[750px] rounded-[60%_40%_50%_50%/40%_50%_60%_50%] bg-gradient-to-l from-[#9146FF]/20 via-purple-600/20 to-fuchsia-700/15 blur-3xl opacity-50 animate-wave-glow" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[480px] w-[1000px] rounded-full bg-gradient-to-r from-purple-800/20 via-[#9146FF]/25 to-fuchsia-700/20 blur-[110px] opacity-50 animate-wave-pulse" />
          <div className="absolute top-0 inset-x-0 h-44 bg-gradient-to-b from-[#9146FF]/15 via-purple-900/8 to-transparent blur-xl" />
        </div>

        {oauthSuccessNotice && (
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-emerald-500/40 bg-emerald-950/40 p-4 text-sm text-emerald-300 shadow-lg shadow-emerald-500/10">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <span className="font-semibold">{oauthSuccessNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setOauthSuccessNotice(null)}
              className="text-xs text-emerald-400/70 hover:text-emerald-300 cursor-pointer"
            >
              Ausblenden
            </button>
          </div>
        )}

        {/* View Routing */}
        {currentView === 'landing' ? (
          <LandingPage
            onGoToDashboard={handleGoToDashboard}
            onOpenAuth={(preferredPlan, channel) => {
              setPreferredPlanForAuth(preferredPlan);
              setInitialChannelForAuth(channel);
              setIsAuthModalOpen(true);
            }}
            onSelectPlan={(plan) => {
              setPreferredPlanForAuth(plan);
              setIsAuthModalOpen(true);
            }}
            onStartTrial={handleStartTrial}
            onDirectPreview={(channel) => {
              handleStartLivePreview(channel);
              setCurrentView('dashboard');
            }}
            onBuyClipPackage={handleBuyClipPackage}
            onOpenStripeCheckout={(plan, cycle) => {
              setStripePlan(plan);
              setStripeClipPack(null);
              setStripeBillingCycle(cycle);
              setIsTrialCheckout(Boolean(plan.tierName?.includes('Testphase') || plan.description?.includes('14 Tage')));
              setIsStripeModalOpen(true);
            }}
            onOpenImpressum={() => setIsImpressumOpen(true)}
            onOpenPrivacy={() => setIsPrivacyOpen(true)}
            onOpenTerms={() => setIsTermsOpen(true)}
            onOpenAvv={() => setIsAvvOpen(true)}
            onOpenGdprAudit={() => setIsGdprAuditOpen(true)}
          />
        ) : !currentUser ? (
          /* CASE 1B: Dashboard without logged-in account (Strict Authentication Gate) */
          <article className="rounded-3xl border border-purple-500/30 bg-gradient-to-b from-[#140b2e] via-[#090518] to-[#070514] p-8 sm:p-12 text-center max-w-xl mx-auto space-y-6 shadow-2xl my-8">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400">
              <Tv className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white font-display">Authentifizierung erforderlich</h2>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Um auf das Dashboard und die autonome Video-Pipeline zuzugreifen, musst du dich mit deinem Account anmelden. Gemäß den Sicherheitsrichtlinien erhalten nicht authentifizierte Besucher keinen Einblick in Dashboard-Ressourcen.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white font-bold text-sm transition shadow-lg shadow-fuchsia-600/30 cursor-pointer"
              >
                Jetzt anmelden / registrieren
              </button>
              <button
                type="button"
                onClick={() => setCurrentView('landing')}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-semibold text-sm transition border border-zinc-700 cursor-pointer"
              >
                Zur Startseite
              </button>
            </div>
          </article>
        ) : !currentUser.hasActiveSubscription || currentUser.plan === 'none' ? (
          /* CASE 2: No active subscription -> Paywall */
          <AccessDeniedPaywall
            user={currentUser}
            onActivateSubscription={handleActivateSubscription}
            onLogout={handleLogout}
          />
        ) : (
          /* CASE 3: Full Streamer Dashboard */
          <StreamerDashboard
            user={currentUser}
            onLogout={handleLogout}
            onUpdateUser={handleUpdateUser}
            onUpgradePlan={handleUpgradePlan}
            onStartTrial={handleStartTrial}
            onOpenImpressum={() => setIsImpressumOpen(true)}
            onOpenPrivacy={() => setIsPrivacyOpen(true)}
            onOpenTerms={() => setIsTermsOpen(true)}
            onOpenAvv={() => setIsAvvOpen(true)}
            onOpenCookieSettings={() => setForceCookieBanner(true)}
            onGoToLanding={handleGoToLanding}
          />
        )}
      </section>

      {/* 4. Seitenleiste / Inspektor (Inspector Panel) */}
      <aside
        aria-label="System Inspector"
        className="inspector-panel border-l border-purple-500/20 bg-[#090518]/90 backdrop-blur-md p-4 flex flex-col justify-between overflow-y-auto text-xs"
      >
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-purple-500/15">
            <div className="flex items-center gap-2 font-mono font-bold text-white uppercase tracking-wider text-xs">
              <Activity className="h-4 w-4 text-emerald-400" />
              <span>System-Inspektor</span>
            </div>
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          {/* Cloud Node Telemetry */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-400">
              Cloud Node Frankfurt (FRA)
            </span>
            <div className="rounded-xl border border-purple-500/20 bg-purple-950/20 p-2.5 space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-zinc-400">Region:</span>
                <span className="text-zinc-200">europe-west3</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">RAM-Puffer:</span>
                <span className="text-emerald-400 font-bold">0 MB (RAM-Only)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">EventSub:</span>
                <span className="text-emerald-400">Aktiviert</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">DSGVO-Audit:</span>
                <span className="text-purple-300">100% Konform</span>
              </div>
            </div>
          </div>

          {/* Account & Quota Meter */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
              Account-Status
            </span>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-zinc-300 font-bold">
                  {currentUser ? currentUser.displayName || currentUser.channelName : 'Gast / Demo'}
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {currentUser ? (currentUser.plan || 'Free').toUpperCase() : 'DEMO'}
                </span>
              </div>

              {/* Quota Progress */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                  <span>Clips verbraucht:</span>
                  <span className="text-white font-semibold">
                    {currentUser ? currentUser.clipsUsedThisMonth || 0 : 0} /{' '}
                    {currentUser ? currentUser.clipsLimitTotal || 30 : 30}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-500 rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        (((currentUser ? currentUser.clipsUsedThisMonth || 0 : 0) /
                          (currentUser ? currentUser.clipsLimitTotal || 30 : 30)) *
                          100) || 5
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Inspector Actions */}
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setIsGdprAuditOpen(true)}
              className="w-full text-left px-2.5 py-1.5 rounded-lg border border-purple-500/20 bg-purple-950/20 hover:bg-purple-900/30 text-purple-300 text-[11px] font-medium transition cursor-pointer flex items-center justify-between"
            >
              <span>DSGVO Selbstauskunft</span>
              <ShieldCheck className="h-3.5 w-3.5 text-purple-400" />
            </button>
            {currentUser && (
              <button
                type="button"
                onClick={() => setIsConfigHubModalOpen(true)}
                className="w-full text-left px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900/40 hover:bg-zinc-800 text-zinc-300 text-[11px] font-medium transition cursor-pointer flex items-center justify-between"
              >
                <span>System Configuration</span>
                <Terminal className="h-3.5 w-3.5 text-zinc-400" />
              </button>
            )}
          </div>
        </div>

        {/* Live Status indicator */}
        <div className="pt-3 border-t border-purple-500/15 flex items-center gap-2 text-[10px] text-zinc-400 font-mono">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Pipeline synchronisiert</span>
        </div>
      </aside>

      {/* 5. Statusleiste & Rechtliches (Status Bar) */}
      <output
        id="status-bar"
        role="status"
        className="border-t border-purple-500/20 bg-[#070514]/95 backdrop-blur-md px-4 py-2.5 text-xs text-zinc-400 flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left z-20"
      >
        {/* Copyright & Brand */}
        <div className="flex items-center gap-2 text-zinc-400 text-xs tracking-tight">
          <span className="font-bold text-zinc-200">© {new Date().getFullYear()} QlipZync</span>
          <span className="text-zinc-600 hidden sm:inline">•</span>
          <span className="text-zinc-500 text-[11px] hidden sm:inline">Autonomous Cloud Systems</span>
        </div>

        {/* Legal Interactive Links */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-medium text-zinc-400">
          <button
            type="button"
            onClick={() => setIsImpressumOpen(true)}
            className="hover:text-[#9146FF] transition cursor-pointer"
          >
            Impressum
          </button>
          <span className="text-zinc-700">•</span>
          <button
            type="button"
            onClick={() => setIsPrivacyOpen(true)}
            className="hover:text-[#9146FF] transition cursor-pointer"
          >
            Datenschutz
          </button>
          <span className="text-zinc-700">•</span>
          <button
            type="button"
            onClick={() => setIsTermsOpen(true)}
            className="hover:text-[#9146FF] transition cursor-pointer"
          >
            AGB
          </button>
          <span className="text-zinc-700">•</span>
          <button
            type="button"
            onClick={() => setIsAvvOpen(true)}
            className="hover:text-[#D946EF] text-fuchsia-400/90 transition cursor-pointer"
          >
            AVV (Art. 28)
          </button>
          <span className="text-zinc-700">•</span>
          <button
            type="button"
            onClick={() => setForceCookieBanner(true)}
            className="hover:text-amber-400 transition cursor-pointer flex items-center gap-1"
          >
            <Cookie className="h-3 w-3 text-amber-400" />
            <span>Cookies</span>
          </button>
        </div>

        {/* Status Pill: 0 MB RAM | ALL SYSTEMS OPERATIONAL */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-[11px] font-semibold text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>0 MB RAM | ALL SYSTEMS OPERATIONAL</span>
          </div>
        </div>
      </output>

      {/* Floating Quick-Switch Dashboard Button when on Landing Page */}
      {currentView === 'landing' && (
        <button
          type="button"
          onClick={handleGoToDashboard}
          className="fixed bottom-12 left-6 z-40 flex items-center gap-2.5 rounded-2xl border border-purple-500/40 bg-[#0c0822]/95 hover:bg-[#180f3d] backdrop-blur-md px-4 py-2.5 text-xs font-bold text-white shadow-2xl shadow-purple-950/80 hover:border-fuchsia-500/70 transition-all duration-200 active:scale-95 cursor-pointer group lg:hidden"
          title="Schnellzugriff: Streamer Dashboard öffnen"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-fuchsia-500 text-white shadow-md shadow-purple-500/30 group-hover:scale-105 transition">
            <LayoutDashboard className="h-4 w-4 text-white" />
          </div>
          <div className="text-left">
            <span className="font-extrabold block text-white leading-none">Dashboard</span>
            <span className="text-[10px] text-fuchsia-400 font-mono block leading-tight">Live anzeigen ↗</span>
          </div>
        </button>
      )}

      {/* Floating Animated Bot Guide: Zero user data leak on landing page */}
      <QuickClickBotGuide
        user={currentView === 'dashboard' ? currentUser : null}
        onNavigateToSection={scrollToSection}
        onOpenAuth={(plan?: SubscriptionPlan) => {
          setPreferredPlanForAuth(plan);
          setIsAuthModalOpen(true);
        }}
        onOpenChannelSetup={() => {
          if (!currentUser) {
            setIsAuthModalOpen(true);
          } else {
            setIsChannelSetupOpen(true);
          }
        }}
        onOpen2FASetup={() => {
          if (!currentUser) {
            setIsAuthModalOpen(true);
          } else {
            setIs2FAModalOpen(true);
          }
        }}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        preferredPlan={preferredPlanForAuth}
        initialChannel={initialChannelForAuth}
        onOpenTerms={() => setIsTermsOpen(true)}
        onOpenPrivacy={() => setIsPrivacyOpen(true)}
        onOpenImpressum={() => setIsImpressumOpen(true)}
      />

      {/* 2FA Modal */}
      {currentUser && (
        <TwoFactorAuthModal
          isOpen={is2FAModalOpen}
          onClose={() => setIs2FAModalOpen(false)}
          user={currentUser}
          onUpdateUser={handleUpdateUser}
        />
      )}

      {/* Channel Setup Wizard Modal */}
      {currentUser && (
        <ChannelSetupWizard
          isOpen={isChannelSetupOpen}
          onClose={() => setIsChannelSetupOpen(false)}
          user={currentUser}
          onUpdateUser={handleUpdateUser}
          onOpen2FA={() => setIs2FAModalOpen(true)}
        />
      )}

      {/* System Configuration Hub Modal */}
      {currentUser && isConfigHubModalOpen && (
        <dialog
          open
          className="fixed inset-0 z-50 m-auto max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-purple-500/30 bg-[#0c0620] p-4 sm:p-6 shadow-2xl backdrop:bg-black/80 backdrop:backdrop-blur-md block my-auto text-left"
        >
          <SystemConfigurationHub
            user={currentUser}
            onUpdateUser={handleUpdateUser}
            onCompleteAndUnlockDashboard={() => {
              const updated: StreamerUser = {
                ...currentUser,
                isFullyConfigured: true,
                onboardingStep: 4,
              };
              handleUpdateUser(updated);
              setIsConfigHubModalOpen(false);
            }}
            isModalView={true}
            onCloseModal={() => setIsConfigHubModalOpen(false)}
            onOpenStripeCheckout={() => {
              setIsConfigHubModalOpen(false);
              setIsStripeModalOpen(true);
            }}
            onOpen2FAModal={() => {
              setIsConfigHubModalOpen(false);
              setIs2FAModalOpen(true);
            }}
          />
        </dialog>
      )}

      {/* Clip Packs Upsell Modal */}
      {currentUser && (
        <ClipPacksModal
          isOpen={isClipPacksModalOpen}
          onClose={() => setIsClipPacksModalOpen(false)}
          onBuyPackage={handleBuyClipPackage}
          currentClipsUsed={currentUser.clipsUsedThisMonth}
          currentClipsTotal={currentUser.clipsLimitTotal || 30}
        />
      )}

      {/* Stripe Real-Time Checkout Modal */}
      <StripeCheckoutModal
        isOpen={isStripeModalOpen}
        onClose={() => {
          setIsStripeModalOpen(false);
          setIsTrialCheckout(false);
        }}
        user={currentUser}
        selectedPlan={stripePlan}
        selectedClipPack={stripeClipPack}
        billingCycle={stripeBillingCycle}
        isTrial={isTrialCheckout}
        onOpenTerms={() => setIsTermsOpen(true)}
        onOpenPrivacy={() => setIsPrivacyOpen(true)}
        onSuccess={(result?: any) => {
          setIsStripeModalOpen(false);
          if (currentUser) {
            if (isTrialCheckout) {
              const updated: StreamerUser = {
                ...currentUser,
                hasActiveSubscription: true,
                plan: 'pro',
                clipsLimitTotal: 90,
                apiCallsLimit: 900,
                modularConfig: stripePlan || BASIC_TRIAL_PLAN,
                trialActive: true,
                trialStartedAt: new Date().toISOString(),
                trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                trialPlan: 'pro',
                trialPriceAfterEur: 12.0,
                trialConvertedToPaid: false,
                trialCancelled: false,
              };
              handleUpdateUser(updated);
              setIsTrialCheckout(false);
            } else if (stripePlan) {
              const planType: SubscriptionPlan = stripePlan.tierLevel >= 4 ? 'elite' : stripePlan.tierLevel >= 2 ? 'pro' : 'creator';
              const updated: StreamerUser = {
                ...currentUser,
                hasActiveSubscription: true,
                plan: planType,
                clipsLimitTotal: stripePlan.clipVolume,
                apiCallsLimit: stripePlan.clipVolume * 8,
                modularConfig: stripePlan,
              };
              handleUpdateUser(updated);
            } else if (stripeClipPack) {
              const updated: StreamerUser = {
                ...currentUser,
                clipsLimitTotal: (currentUser.clipsLimitTotal || 30) + stripeClipPack.clips,
                extraPacksPurchased: (currentUser.extraPacksPurchased || 0) + stripeClipPack.clips,
              };
              handleUpdateUser(updated);
            }
          }
        }}
      />

      {/* Cookie Consent Banner */}
      <CookieConsentBanner
        forceOpen={forceCookieBanner}
        onOpenPrivacy={() => setIsPrivacyOpen(true)}
        onClose={() => setForceCookieBanner(false)}
      />

      {/* Legal Modals */}
      <ImpressumModal
        isOpen={isImpressumOpen}
        onClose={() => {
          setIsImpressumOpen(false);
          clearModalHash();
        }}
      />
      <PrivacyPolicyModal
        isOpen={isPrivacyOpen}
        onClose={() => {
          setIsPrivacyOpen(false);
          clearModalHash();
        }}
        onOpenAvv={() => setIsAvvOpen(true)}
        onOpenTerms={() => setIsTermsOpen(true)}
      />
      <TermsAndConditionsModal
        isOpen={isTermsOpen}
        onClose={() => {
          setIsTermsOpen(false);
          clearModalHash();
        }}
        onOpenPrivacy={() => setIsPrivacyOpen(true)}
        onOpenImpressum={() => setIsImpressumOpen(true)}
      />
      <AvvAgreementModal
        isOpen={isAvvOpen}
        onClose={() => {
          setIsAvvOpen(false);
          clearModalHash();
        }}
        user={currentUser}
        onOpenPrivacy={() => setIsPrivacyOpen(true)}
      />
      <GdprPrivacyAuditModal
        isOpen={isGdprAuditOpen}
        onClose={() => {
          setIsGdprAuditOpen(false);
          clearModalHash();
        }}
        user={
          currentUser || {
            id: 'guest_visitor',
            name: 'Gast / Besucher',
            channelName: 'guest',
            email: 'guest@quickclick.local',
            avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=faces',
            plan: 'creator',
            clipsUsedThisMonth: 0,
            clipsLimitTotal: 30,
            extraPacksPurchased: 0,
            apiCallsUsed: 0,
            apiCallsLimit: 240,
            referralCount: 0,
            earnedCredits: 0,
            hasActiveSubscription: false,
            role: 'streamer',
            isLive: false,
            streamTitle: '',
            game: '',
            viewers: 0,
            twitchConnected: false,
            googleConnected: false,
            twoFactorAuth: { isEnabled: false, isVerified: false, method: 'email_code' },
          }
        }
        onAccountDeleted={handleLogout}
        onOpenPrivacyPolicy={() => setIsPrivacyOpen(true)}
        onOpenAvvAgreement={() => setIsAvvOpen(true)}
      />
    </main>
  );
}
