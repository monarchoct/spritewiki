import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  BadgeCheck,
  Crown,
  ExternalLink,
  Gauge,
  ImagePlus,
  Lock,
  LogOut,
  Menu,
  ShieldCheck,
  Trophy,
  Upload,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import "./styles.css";

type User = {
  id: string;
  xId: string;
  handle: string;
  name: string;
  avatarUrl?: string;
  walletAddress?: string;
  isAdmin: boolean;
  nominationsUsed: number;
};

type Submission = {
  id: string;
  name: string;
  creatorHandle: string;
  creatorName: string;
  imageUrl: string;
  imageUrls?: string[];
  tweetUrl: string;
  lore: string;
  powers: string;
  status: "approved" | "pending" | "rejected" | "bonus";
  nominations: number;
  rank: number;
  payoutUsd: number;
  createdAt: string;
  nominatedByMe?: boolean;
};

type AdminSubmission = Submission & {
  creatorWallet?: string;
  bonusWinner?: boolean;
};

type Pot = {
  totalUsd: number;
  totalSol?: number;
  solUsd?: number;
  walletAddress?: string;
  lastSyncedAt?: string;
  source: "manual" | "solana";
};

type Bootstrap = {
  user: User | null;
  pot: Pot;
  submissions: Submission[];
  nominationsRemaining: number;
  contestEndsAt: string;
};

const sampleSubmissions: Submission[] = [
  {
    id: "sample-1",
    name: "Pond Sprite",
    creatorHandle: "matsubokiri",
    creatorName: "Matsubokiri",
    imageUrl: "",
    tweetUrl: "https://x.com/matsubokiri/status/180000000001",
    lore: "A pocket ghost that flickers when the storm closes in.",
    powers: "Phase blink, shield pulse, tiny decoy trail.",
    status: "approved",
    nominations: 312,
    rank: 1,
    payoutUsd: 8.4,
    createdAt: "2026-06-11T12:00:00.000Z",
  },
  {
    id: "sample-2",
    name: "Zuzu",
    creatorHandle: "dreamdrop",
    creatorName: "Dreamdrop",
    imageUrl: "",
    tweetUrl: "https://x.com/dreamdrop/status/180000000002",
    lore: "A goofy neon spirit with hair like comet smoke.",
    powers: "Loot ping, bounce charm, revival shimmer.",
    status: "approved",
    nominations: 284,
    rank: 2,
    payoutUsd: 6.3,
    createdAt: "2026-06-12T12:00:00.000Z",
  },
  {
    id: "sample-3",
    name: "Boltcap",
    creatorHandle: "pixelriot",
    creatorName: "Pixel Riot",
    imageUrl: "",
    tweetUrl: "https://x.com/pixelriot/status/180000000003",
    lore: "A mischievous arcade sprite that lives in broken vending machines.",
    powers: "Zap dash, vending luck, shockwave giggle.",
    status: "approved",
    nominations: 247,
    rank: 3,
    payoutUsd: 5.04,
    createdAt: "2026-06-13T12:00:00.000Z",
  },
  {
    id: "sample-4",
    name: "Mallow",
    creatorHandle: "softspawn",
    creatorName: "Softspawn",
    imageUrl: "",
    tweetUrl: "https://x.com/softspawn/status/180000000004",
    lore: "A marshmallow-bright companion with a moonlit backpack.",
    powers: "Quiet glide, heal twinkle, map whisper.",
    status: "approved",
    nominations: 221,
    rank: 4,
    payoutUsd: 4.2,
    createdAt: "2026-06-14T12:00:00.000Z",
  },
  {
    id: "sample-5",
    name: "Riftling",
    creatorHandle: "neonorbit",
    creatorName: "Neon Orbit",
    imageUrl: "",
    tweetUrl: "https://x.com/neonorbit/status/180000000005",
    lore: "A tiny rift-born ghost with starry cheeks and a tactical visor.",
    powers: "Portal pop, danger hum, glider spark.",
    status: "approved",
    nominations: 198,
    rank: 5,
    payoutUsd: 3.36,
    createdAt: "2026-06-15T12:00:00.000Z",
  },
  {
    id: "sample-6",
    name: "Glim",
    creatorHandle: "spectralux",
    creatorName: "Spectra Lux",
    imageUrl: "",
    tweetUrl: "https://x.com/spectralux/status/180000000006",
    lore: "A shy blue flame that becomes brave around squads.",
    powers: "Squad aura, candle shield, floaty scout.",
    status: "approved",
    nominations: 172,
    rank: 6,
    payoutUsd: 2.94,
    createdAt: "2026-06-16T12:00:00.000Z",
  },
];

const rankWeights = [20, 15, 12, 10, 8, 7, 6, 5, 4, 3];
const leaderboardPrizePoolShare = 0.7;

const expandedSampleSubmissions: Submission[] = Array.from({ length: 48 }, (_, index) => {
  const base = sampleSubmissions[index % sampleSubmissions.length];
  const cycle = Math.floor(index / sampleSubmissions.length);
  return {
    ...base,
    id: `sample-${index + 1}`,
    name: cycle === 0 ? base.name : `${base.name} ${cycle + 1}`,
    nominations: Math.max(24, base.nominations - cycle * 31 - (index % sampleSubmissions.length) * 3),
    rank: index + 1,
    payoutUsd: payoutForRank(index + 1, 42),
    nominatedByMe: false,
  };
});

const fallbackBootstrap: Bootstrap = {
  user: null,
  pot: {
    totalUsd: 42,
    source: "manual",
    lastSyncedAt: new Date().toISOString(),
  },
  submissions: expandedSampleSubmissions,
  nominationsRemaining: 3,
  contestEndsAt: "2026-07-01T21:59:59.000Z",
};

const placeholderSpriteImages = [
  "/pond-sprite-placeholder.png",
  "/sprite-placeholder-chaos.png",
  "/sprite-placeholder-rift.png",
  "/sprite-placeholder-tank.png",
  "/sprite-placeholder-guff.png",
  "/sprite-placeholder-cherisplit.png",
];

function payoutForRank(rank: number, pot: number) {
  const leaderboardPool = pot * leaderboardPrizePoolShare;
  if (rank <= 10) return leaderboardPool * (rankWeights[rank - 1] / 100);
  if (rank <= 40) return (leaderboardPool * 0.1) / 30;
  return 0;
}

function rankSubmissions(submissions: Submission[], potUsd: number) {
  return submissions
    .slice()
    .sort((a, b) => b.nominations - a.nominations || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((submission, index) => ({
      ...submission,
      rank: index + 1,
      payoutUsd: payoutForRank(index + 1, potUsd),
    }));
}

function formatUsd(value: number) {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function useCountdown(targetIso: string) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return useMemo(() => {
    const distance = Math.max(0, new Date(targetIso).getTime() - now);
    const days = Math.floor(distance / 86_400_000);
    const hours = Math.floor((distance % 86_400_000) / 3_600_000);
    const minutes = Math.floor((distance % 3_600_000) / 60_000);
    const seconds = Math.floor((distance % 60_000) / 1000);
    return { days, hours, minutes, seconds };
  }, [now, targetIso]);
}

function shortAddress(address?: string) {
  if (!address) return "No wallet linked";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function useParallax() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrollY(window.scrollY));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return scrollY;
}

function useBootstrap() {
  const [state, setState] = useState<Bootstrap>(fallbackBootstrap);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    try {
      const response = await fetch("/api/bootstrap", { credentials: "include" });
      if (!response.ok) throw new Error("bootstrap failed");
      const data = (await response.json()) as Bootstrap;
      setState(data);
    } catch {
      setState(fallbackBootstrap);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  return { state, setState, reload, loading };
}

function SpriteAvatar({ index = 0, url, name }: { index?: number; url?: string; name: string }) {
  const imageUrl = url || placeholderSpriteImages[index % placeholderSpriteImages.length];

  return <img className="sprite-avatar placeholder-art" src={imageUrl} alt={`${name} sprite`} loading="lazy" />;
}

function getSubmissionImages(submission: Submission, index: number) {
  const images = submission.imageUrls?.length ? submission.imageUrls : [submission.imageUrl];
  return images
    .filter((url): url is string => Boolean(url))
    .map((url) => ({ url, isPlaceholder: false }))
    .concat(images.some(Boolean) ? [] : [{ url: placeholderSpriteImages[index % placeholderSpriteImages.length], isPlaceholder: true }]);
}

function Nav({
  activeTab,
  setActiveTab,
  user,
  onConnect,
  onLogout,
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: User | null;
  onConnect: () => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const items = [
    ["gallery", "Gallery"],
    ["leaderboard", "Leaderboard"],
    ["info", "Info"],
    ["profile", "Profile"],
    ...(user?.isAdmin ? [["admin", "Admin"]] : []),
  ];

  return (
    <header className="nav-shell">
      <a href="#top" className="brand" onClick={() => setActiveTab("gallery")} aria-label="SPRITE home">
        <span className="brand-mark">
          <img src="/sprite-official-logo.png" alt="" />
        </span>
      </a>
      <button className="icon-button menu-button" onClick={() => setOpen((value) => !value)} aria-label="Toggle menu">
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      <nav className={open ? "nav-links open" : "nav-links"}>
        {items.map(([id, label]) => (
          <button
            key={id}
            className={activeTab === id ? "nav-link active" : "nav-link"}
            onClick={() => {
              setActiveTab(id);
              setOpen(false);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="nav-actions">
        {user ? (
          <>
            <button className="user-chip" onClick={() => setActiveTab("profile")}>
              <span>@{user.handle}</span>
              <UserRound size={16} />
            </button>
            <button className="icon-button" onClick={onLogout} aria-label="Log out">
              <LogOut size={18} />
            </button>
          </>
        ) : (
          <button className="primary-button small nav-connect-button" onClick={onConnect}>
            <img className="x-login-icon" src="/x-login-icon.png" alt="" aria-hidden="true" />
            Connect X
          </button>
        )}
      </div>
    </header>
  );
}

function Hero({
  pot,
  contestEndsAt,
  activeTab,
  setActiveTab,
}: {
  pot: Pot;
  contestEndsAt: string;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}) {
  const scrollY = useParallax();
  const isTucked = activeTab !== "gallery";
  const countdown = useCountdown(contestEndsAt);
  const countdownParts = [
    ["Days", countdown.days],
    ["Hours", countdown.hours],
    ["Minutes", countdown.minutes],
    ["Seconds", countdown.seconds],
  ];

  const heroClassName = [
    "hero-section",
    isTucked ? "hero-section--tucked" : "",
    activeTab === "leaderboard" ? "hero-section--leaderboard" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section id="top" className={heroClassName}>
      <div
        className="hero-depth depth-one"
        style={{ transform: `translate3d(0, ${scrollY * 0.08}px, 0)` }}
      />
      <div
        className="hero-depth depth-two"
        style={{ transform: `translate3d(0, ${scrollY * -0.05}px, 0)` }}
      />
      <div className="hero-wordmark" aria-hidden="true">
        UPLOAD
      </div>
      <img
        className="hero-sprite-outline"
        src="/hero-sprite-bg-updated.png"
        alt=""
        aria-hidden="true"
        style={{ transform: `translate3d(0, ${scrollY * 0.035}px, 0)` }}
      />
      <div className="hero-copy">
        <h1>
          {isTucked ? (
            "Upload sprites. Win prizes."
          ) : (
            <>
              Upload
              <br />
              sprites.
              <br />
              Win
              <br />
              Prizes.
            </>
          )}
        </h1>
        <p>
          We made a Website for you to upload and show off your sprites, also we are running our own competition where
          the top artists win prizes.
        </p>
        <div className="hero-actions">
          <button className="primary-button" onClick={() => setActiveTab("profile")}>
            <Upload size={18} />
            Submit Sprite
          </button>
          <button className="secondary-button" onClick={() => setActiveTab("leaderboard")}>
            <Trophy size={18} />
            View Top 40
          </button>
        </div>
      </div>
      <aside className="hero-console" aria-label="contest stats">
        <div className="pot-module">
          <div>
            <span>Prize Pool</span>
            <strong>{formatUsd(pot.totalUsd)}</strong>
          </div>
          <img className="pot-logo" src="/prize-potion-icon.svg" alt="" />
        </div>
        <div className="countdown-card" aria-label="Contest countdown">
          <strong>Contest ends in</strong>
          <div className="countdown-grid">
            {countdownParts.map(([label, value]) => (
              <div className="countdown-unit" key={label}>
                <b>{String(value).padStart(2, "0")}</b>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </section>
  );
}

function SubmissionCard({
  submission,
  index,
  canNominate,
  onNominate,
  onOpen,
  isOpening = false,
}: {
  submission: Submission;
  index: number;
  canNominate: boolean;
  onNominate: (id: string) => Promise<boolean>;
  onOpen: (submission: Submission) => void;
  isOpening?: boolean;
}) {
  const [isNominationBursting, setIsNominationBursting] = useState(false);
  const [isNominationPending, setIsNominationPending] = useState(false);
  const openSubmission = () => onOpen(submission);
  const isNominationLocked = Boolean(submission.nominatedByMe || (isNominationPending && canNominate));

  const nominateSubmission = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (submission.nominatedByMe || isNominationPending) return;

    setIsNominationPending(true);
    const nominated = await onNominate(submission.id);
    setIsNominationPending(false);

    if (!nominated) return;
    setIsNominationBursting(true);
    window.setTimeout(() => setIsNominationBursting(false), 760);
  };

  return (
    <article
      className={[
        "submission-card",
        submission.nominatedByMe ? "nominated" : "",
        isNominationBursting ? "nomination-bursting" : "",
        isOpening ? "opening" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="button"
      tabIndex={0}
      aria-label={`${submission.name}. Open sprite details.`}
      onClick={openSubmission}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openSubmission();
        }
      }}
    >
      <SpriteAvatar index={index} url={submission.imageUrl} name={submission.name} />
      <div className="card-meta-row">
        <div className="card-body">
          <div className="card-title-row">
            <h3>{submission.name}</h3>
            {submission.status === "bonus" && <Crown size={20} />}
          </div>
          <span className="creator-label">@{submission.creatorHandle}</span>
        </div>
        <div className="card-footer">
          <button
            className={[
              "hot-badge",
              submission.nominatedByMe ? "nominated" : "",
              isNominationBursting ? "burst" : "",
              isNominationPending ? "pending" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            type="button"
            onClick={nominateSubmission}
            disabled={submission.nominatedByMe || isNominationPending || (!canNominate && !submission.nominatedByMe)}
            aria-label={submission.nominatedByMe ? `${submission.name} nominated` : `Nominate ${submission.name}`}
            aria-pressed={isNominationLocked}
          >
            <span className="hot-flame" aria-hidden="true">
              <img src="/fire-vote.png" alt="" />
            </span>
            <strong>{submission.nominations.toLocaleString()}</strong>
          </button>
        </div>
      </div>
    </article>
  );
}

function NominationMeter({ nominationsRemaining, maxNominations = 3 }: { nominationsRemaining: number; maxNominations?: number }) {
  const clampedRemaining = Math.max(0, Math.min(maxNominations, nominationsRemaining));
  const [showHelp, setShowHelp] = useState(false);

  return (
    <aside className="nomination-meter" aria-label={`${clampedRemaining} nominations left`}>
      <div className="nomination-meter-copy">
        <span>Nominations Left</span>
        <button
          className={showHelp ? "nomination-help open" : "nomination-help"}
          type="button"
          aria-label="How nominations work"
          aria-expanded={showHelp}
          onClick={() => setShowHelp((current) => !current)}
          onBlur={() => setShowHelp(false)}
        >
          ?
          <span className="nomination-help-popover" role="tooltip">
            You can nominate up to 3 designs. Connect X, open a sprite, then tap the flame button on your favorites.
          </span>
        </button>
      </div>
      <div className="nomination-flames" aria-hidden="true">
        {Array.from({ length: maxNominations }, (_, index) => (
          <span className={index < clampedRemaining ? "nomination-flame active" : "nomination-flame"} key={index}>
            <img src="/fire-vote.png" alt="" />
          </span>
        ))}
      </div>
    </aside>
  );
}

function SubmissionDetailModal({
  submission,
  index,
  canNominate,
  onClose,
  onNominate,
}: {
  submission: Submission;
  index: number;
  canNominate: boolean;
  onClose: () => void;
  onNominate: (id: string) => Promise<boolean>;
}) {
  const images = getSubmissionImages(submission, index);
  const [isNominationBursting, setIsNominationBursting] = useState(false);
  const [isNominationPending, setIsNominationPending] = useState(false);

  const nominateSubmission = async () => {
    if (submission.nominatedByMe || isNominationPending) return;

    setIsNominationPending(true);
    const nominated = await onNominate(submission.id);
    setIsNominationPending(false);

    if (!nominated) return;
    setIsNominationBursting(true);
    window.setTimeout(() => setIsNominationBursting(false), 760);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="sprite-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${submission.name} details`}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close sprite details">
          <X size={20} />
        </button>
        <div className="modal-gallery" aria-label={`${submission.name} uploaded images`}>
          {images.map((image, imageIndex) => (
            <figure className="modal-art-frame" key={`${image.url}-${imageIndex}`}>
              <img
                className="modal-full-image"
                src={image.url}
                alt={images.length > 1 ? `${submission.name} uploaded image ${imageIndex + 1}` : `${submission.name} uploaded sprite`}
                loading={imageIndex === 0 ? "eager" : "lazy"}
              />
              <figcaption>
                <span>{images.length > 1 ? `Upload ${imageIndex + 1}` : "Uploaded art"}</span>
                {!image.isPlaceholder && (
                  <a href={image.url} target="_blank" rel="noreferrer">
                    Open full size
                    <ArrowUpRight size={15} />
                  </a>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="modal-info">
          <div className="modal-title-row">
            <div>
              <span className="modal-rank">Rank #{submission.rank}</span>
              <h2>{submission.name}</h2>
              <p>@{submission.creatorHandle}</p>
            </div>
            <button
              className={[
                "hot-badge",
                "modal-vote",
                submission.nominatedByMe ? "nominated" : "",
                isNominationBursting ? "burst" : "",
                isNominationPending ? "pending" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              type="button"
              onClick={nominateSubmission}
              disabled={submission.nominatedByMe || isNominationPending || (!canNominate && !submission.nominatedByMe)}
              aria-label={submission.nominatedByMe ? `${submission.name} nominated` : `Nominate ${submission.name}`}
              aria-pressed={Boolean(submission.nominatedByMe)}
            >
              <span className="hot-flame" aria-hidden="true">
                <img src="/fire-vote.png" alt="" />
              </span>
              <strong>{submission.nominations.toLocaleString()}</strong>
            </button>
          </div>
          <div className="modal-stat-grid">
            <div>
              <span>Projected payout</span>
              <strong>{formatUsd(submission.payoutUsd)}</strong>
            </div>
            <div>
              <span>Nominations</span>
              <strong>{submission.nominations.toLocaleString()}</strong>
            </div>
          </div>
          <div className="modal-section">
            <h3>Sprite info</h3>
            <p>{submission.lore}</p>
          </div>
          <div className="modal-section">
            <h3>Powers</h3>
            <p>{submission.powers}</p>
          </div>
          <a className="modal-tweet-link" href={submission.tweetUrl} target="_blank" rel="noreferrer">
            View original tweet
            <ExternalLink size={17} />
          </a>
        </div>
      </section>
    </div>
  );
}

function ConnectVotePrompt({ onClose, onConnect }: { onClose: () => void; onConnect: () => void }) {
  return (
    <div className="vote-prompt-backdrop" role="presentation" onClick={onClose}>
      <section className="vote-prompt" role="dialog" aria-modal="true" aria-label="Connect X to vote" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close connect prompt">
          <X size={20} />
        </button>
        <img className="vote-prompt-flame" src="/fire-vote.png" alt="" aria-hidden="true" />
        <h2>Connect X to vote!</h2>
        <p>You need a connected X account to use your 3 nominations.</p>
        <button className="primary-button full" type="button" onClick={onConnect}>
          <span className="x-logo-mark" aria-hidden="true">X</span>
          Connect X
        </button>
      </section>
    </div>
  );
}

function HowItWorksRail({ setActiveTab }: { setActiveTab: (tab: string) => void }) {
  const steps = [
    {
      number: "1",
      label: "Submit Sprite",
      helper: "Upload PNG or GIF",
      tab: "profile",
    },
    {
      number: "2",
      label: "Earn Votes",
      helper: "X users nominate",
      tab: "gallery",
    },
    {
      number: "3",
      label: "Win Prize Pool",
      helper: "Open leaderboard",
      tab: "leaderboard",
    },
  ];

  return (
    <aside className="how-rail" aria-label="How to win">
      {steps.map((step) => (
        <button className="how-rail-step" type="button" key={step.number} onClick={() => setActiveTab(step.tab)}>
          <span className="how-rail-number">{step.number}</span>
          <span className="how-rail-glass">
            <strong>{step.label}</strong>
            <small>{step.helper}</small>
          </span>
        </button>
      ))}
    </aside>
  );
}

function Gallery({
  submissions,
  user,
  nominationsRemaining,
  onNominate,
  onOpenSubmission,
  setActiveTab,
}: {
  submissions: Submission[];
  user: User | null;
  nominationsRemaining: number;
  onNominate: (id: string) => Promise<boolean>;
  onOpenSubmission: (submission: Submission, index: number) => void;
  setActiveTab: (tab: string) => void;
}) {
  const pageSize = 24;
  const [page, setPage] = useState(0);
  const [sortMode, setSortMode] = useState<"rank" | "latest">("rank");
  const [openingSubmissionId, setOpeningSubmissionId] = useState<string | null>(null);
  const openDelayRef = useRef<number | null>(null);
  const sortedSubmissions = useMemo(() => {
    const orderedSubmissions = [...submissions];
    if (sortMode === "latest") {
      return orderedSubmissions.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    return orderedSubmissions.sort((a, b) => a.rank - b.rank);
  }, [submissions, sortMode]);
  const totalPages = Math.max(1, Math.ceil(sortedSubmissions.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageItems = sortedSubmissions.slice(currentPage * pageSize, currentPage * pageSize + pageSize);
  const galleryAnimationKey = `${sortMode}-${currentPage}`;

  useEffect(() => {
    return () => {
      if (openDelayRef.current) window.clearTimeout(openDelayRef.current);
    };
  }, []);

  const changeSort = (nextSortMode: "rank" | "latest") => {
    if (nextSortMode === sortMode) return;
    setSortMode(nextSortMode);
    setPage(0);
  };

  const goToPage = (nextPage: number) => {
    const clampedPage = Math.max(0, Math.min(totalPages - 1, nextPage));
    setPage(clampedPage);
    window.requestAnimationFrame(() => {
      document.querySelector(".gallery-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const openSubmissionWithAnimation = (submission: Submission, index: number) => {
    setOpeningSubmissionId(submission.id);
    if (openDelayRef.current) window.clearTimeout(openDelayRef.current);

    openDelayRef.current = window.setTimeout(() => {
      onOpenSubmission(submission, index);
      setOpeningSubmissionId(null);
      openDelayRef.current = null;
    }, 155);
  };

  return (
    <section className="section-shell gallery-section">
      <div className="section-heading">
        <div>
          <h2>Community grid</h2>
          <p>Browse all the Sprites that already got uploaded!</p>
        </div>
        <div className="gallery-controls">
          <div className="sort-control" role="group" aria-label="Sort submissions">
            <button
              className={sortMode === "rank" ? "active" : ""}
              type="button"
              onClick={() => changeSort("rank")}
            >
              Rank
            </button>
            <button
              className={sortMode === "latest" ? "active" : ""}
              type="button"
              onClick={() => changeSort("latest")}
            >
              Latest
            </button>
          </div>
          <button className="secondary-button" onClick={() => setActiveTab("profile")}>
            <ImagePlus size={18} />
            New Submission
          </button>
        </div>
      </div>
      <div className="gallery-pager top">
        <span>
          Page {currentPage + 1} / {totalPages}
        </span>
        <div className="pager-actions">
          <button className="secondary-button pager-button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 0}>
            Prev
          </button>
          <button
            className="secondary-button pager-button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
          >
            Next
          </button>
        </div>
      </div>
      <div className={pageItems.length <= 2 ? "submission-grid sparse" : "submission-grid"} key={galleryAnimationKey}>
        {pageItems.map((submission, index) => (
          <SubmissionCard
            key={submission.id}
            submission={submission}
            index={currentPage * pageSize + index}
            canNominate={!user || nominationsRemaining > 0}
            onNominate={onNominate}
            onOpen={(openSubmission) => openSubmissionWithAnimation(openSubmission, currentPage * pageSize + index)}
            isOpening={openingSubmissionId === submission.id}
          />
        ))}
      </div>
      <div className="gallery-pager bottom">
        <div className="page-dots" aria-label="Gallery pages">
          {Array.from({ length: totalPages }, (_, index) => (
            <button
              key={index}
              className={index === currentPage ? "page-dot active" : "page-dot"}
              onClick={() => goToPage(index)}
              aria-label={`Go to page ${index + 1}`}
            />
          ))}
        </div>
        <div className="pager-actions">
          <button className="secondary-button pager-button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 0}>
            Prev
          </button>
          <button
            className="secondary-button pager-button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

function Leaderboard({
  submissions,
  pot,
  onOpenSubmission,
}: {
  submissions: Submission[];
  pot: Pot;
  onOpenSubmission: (submission: Submission, index: number) => void;
}) {
  const [animatedPrizeUsd, setAnimatedPrizeUsd] = useState(0);

  useEffect(() => {
    let animationFrame = 0;
    let startTime: number | null = null;
    const durationMs = 1800;

    const tick = (timestamp: number) => {
      startTime ??= timestamp;
      const progress = Math.min((timestamp - startTime) / durationMs, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      setAnimatedPrizeUsd(Number((pot.totalUsd * easedProgress).toFixed(2)));

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(tick);
      } else {
        setAnimatedPrizeUsd(pot.totalUsd);
      }
    };

    setAnimatedPrizeUsd(0);
    animationFrame = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [pot.totalUsd]);

  const rows = useMemo(() => {
    const base = submissions.length
      ? submissions
      : Array.from({ length: 40 }, (_, index) => ({
          ...sampleSubmissions[index % sampleSubmissions.length],
          id: `fallback-${index + 1}`,
          rank: index + 1,
          nominations: Math.max(18, 320 - index * 7),
        }));

    return rankSubmissions(base, pot.totalUsd).slice(0, 40);
  }, [submissions, pot.totalUsd]);
  const topRows = rows.slice(0, 3);

  return (
    <section className="section-shell leaderboard-section">
      <div className="leaderboard-hero">
        <div className="leaderboard-hero-copy">
          <h2>Leaderboard</h2>
        </div>
        <div className="leaderboard-prize-stage">
          <div className="leaderboard-prize" aria-label={`Total prize pool ${formatUsd(animatedPrizeUsd)}`}>
            <span>Total prize pool</span>
            <strong>{formatUsd(animatedPrizeUsd)}</strong>
          </div>
          <aside className="creator-bonus-card" aria-label="Actual game bonus">
            <div className="secret-art-frame" aria-hidden="true">
              <Lock size={42} />
              <span>To be revealed</span>
            </div>
            <div className="creator-bonus-copy">
              <span>Actual game bonus</span>
              <strong>30% prize pool</strong>
              <p>If your Sprite makes it into the actual game, you get 30% of the prize pool.</p>
            </div>
          </aside>
        </div>
      </div>
      <div className="podium-grid" aria-label="Top three sprites">
        {topRows.map((row, index) => (
          <button
            key={row.id}
            className={`podium-card podium-rank-${row.rank}`}
            type="button"
            onClick={() => onOpenSubmission(row, index)}
            aria-label={`${row.name}. Rank ${row.rank}. Open sprite details.`}
          >
            <div className="podium-rank" aria-hidden="true">
              <img src={`/trophy-rank-${row.rank}.png`} alt="" className="rank-trophy-image" />
              <strong>#{row.rank}</strong>
              <small>{row.rank === 1 ? "Champion" : row.rank === 2 ? "Runner up" : "Top 3"}</small>
            </div>
            <SpriteAvatar index={row.rank} url={row.imageUrl} name={row.name} />
            <div className="podium-meta">
              <h3>{row.name}</h3>
              <p>@{row.creatorHandle}</p>
            </div>
            <div className="podium-stats">
              <span className={row.nominatedByMe ? "nomination-pill nominated" : "nomination-pill"}>
                <img src="/fire-vote.png" alt="" aria-hidden="true" />
                <strong>{row.nominations.toLocaleString()}</strong>
              </span>
              <span className="podium-payout">{formatUsd(row.payoutUsd)}</span>
            </div>
          </button>
        ))}
      </div>
      <div className="leaderboard-table">
        <div className="leaderboard-row header">
          <span>Rank</span>
          <span>Sprite</span>
          <span>Nominations</span>
          <span>Projected payout</span>
        </div>
        {rows.map((row, index) => (
          <button
            key={row.id}
            className={row.rank <= 3 ? "leaderboard-row podium" : "leaderboard-row"}
            type="button"
            onClick={() => onOpenSubmission(row, index)}
            aria-label={`${row.name}. Rank ${row.rank}. Open sprite details.`}
          >
            <span className="rank-cell">#{row.rank}</span>
            <span className="sprite-cell">
              <SpriteAvatar index={row.rank} url={row.imageUrl} name={row.name} />
              <span>
                <strong>{row.name}</strong>
                <small>@{row.creatorHandle}</small>
              </span>
            </span>
            <span className="nomination-cell">
              <span className={row.nominatedByMe ? "nomination-pill nominated" : "nomination-pill"}>
                <img src="/fire-vote.png" alt="" aria-hidden="true" />
                <strong>{row.nominations.toLocaleString()}</strong>
              </span>
            </span>
            <span className="payout-cell">{formatUsd(row.payoutUsd)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function InfoPanel({ pot }: { pot: Pot }) {
  const infoNodes = [
    {
      className: "top",
      stat: "STEP 01",
      title: "Submit Sprite",
      copy: "Upload your design image, X post, sprite name, lore, and powers.",
    },
    {
      className: "right-top",
      stat: "3 TOTAL",
      title: "Earn nominations",
      copy: "Connected X users can nominate up to 3 Sprite designs total.",
    },
    {
      className: "right-bottom",
      stat: "TOP 40",
      title: "Top 40 paid",
      copy: "Leaderboard entries split the ranked prize model, then payouts are processed after results finalize.",
    },
    {
      className: "bottom",
      stat: "30%",
      title: "Game bonus",
      copy: "If your Sprite makes it into the actual game, you get 30% of the prize pool.",
    },
    {
      className: "left-bottom",
      stat: "WALLET",
      title: "Redeem payouts",
      copy: "Connect a Solana wallet in Profile. Admins export rank, X handle, and wallet for manual payout.",
    },
    {
      className: "left-top",
      stat: formatUsd(pot.totalUsd),
      title: "Prize pool",
      copy: "The pool grows over time as trading volume on the coin routes fees into the contest wallet.",
    },
  ];

  return (
    <section className="section-shell info-section">
      <div className="info-orbit-shell">
        <div className="info-orbit-heading">
          <span className="info-kicker">Contest overview</span>
          <h2>How SPRITE works</h2>
          <p>
            Upload a Fortnite-style companion, earn nominations, and climb toward a prize pool funded by coin trading
            fees over time. Winners redeem payouts by linking a Solana wallet in Profile before payout export.
          </p>
        </div>

        <div className="info-orbit-map" aria-label="SPRITE contest information">
          <div className="info-orbit-rings" aria-hidden="true" />
          <div className="info-orbit-line vertical" aria-hidden="true" />
          <div className="info-orbit-line horizontal" aria-hidden="true" />
          <div className="info-orbit-line diagonal-a" aria-hidden="true" />
          <div className="info-orbit-line diagonal-b" aria-hidden="true" />
          <div className="info-center-sprite">
            <img src="/info-blue-sprite.png" alt="Blue Sprite character" />
          </div>
          {infoNodes.map((node) => (
            <article className={`info-orbit-node ${node.className}`} key={node.title}>
              <strong>{node.stat}</strong>
              <div>
                <h3>{node.title}</h3>
                <p>{node.copy}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="info-detail-grid" aria-label="Important contest details">
          <article className="info-detail-card">
            <Gauge size={26} />
            <h3>How the coin funds the contest</h3>
            <p>
              SPRITE runs our own parallel creator contest. Trading fees from the memecoin route value into the contest
              wallet over time, so the displayed {formatUsd(pot.totalUsd)} pool can keep growing as volume comes in.
            </p>
            <p>No one pays a submission fee on this site. Uploading and nominating are separate from trading.</p>
          </article>

          <article className="info-detail-card payout">
            <Wallet size={26} />
            <h3>How to redeem payouts</h3>
            <ol>
              <li>Connect X so your submission and nominations are tied to your account.</li>
              <li>Open Profile and connect your Solana wallet. That wallet is the payout address.</li>
              <li>If you finish in the paid ranks or win the game bonus, admins export your rank, X handle, and wallet.</li>
              <li>Payouts are sent manually to the linked wallet after results are finalized.</li>
            </ol>
            <p>If no wallet is linked, the payout export will show that your payout wallet is missing.</p>
          </article>

          <article className="info-detail-card">
            <ShieldCheck size={26} />
            <h3>Important rules</h3>
            <p>
              Connected X users get 3 nominations total. Submissions are reviewed before they appear in the gallery, and
              the top 40 split the ranked prize model shown on the leaderboard.
            </p>
            <p>This is an independent community contest, not an official Epic Games or Fortnite promotion.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function Profile({
  user,
  onConnectX,
  onWalletSaved,
}: {
  user: User | null;
  onConnectX: () => void;
  onWalletSaved: (wallet: string) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    tweetUrl: "",
    lore: "",
    powers: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formLocked = !user;

  const connectWallet = async () => {
    const solana = (window as Window & { solana?: { connect: () => Promise<{ publicKey: { toString: () => string } }> } })
      .solana;
    if (!solana) {
      setMessage("Install Phantom or another Solana wallet to connect for payouts.");
      return;
    }

    try {
      const result = await solana.connect();
      const walletAddress = result.publicKey.toString();
      const response = await fetch("/api/profile/wallet", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      if (!response.ok) throw new Error("wallet save failed");
      onWalletSaved(walletAddress);
      setMessage("Wallet linked for payouts.");
    } catch {
      setMessage("Wallet connection was cancelled or failed.");
    }
  };

  const submitSprite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) {
      onConnectX();
      return;
    }
    if (!file) {
      setMessage("Choose a PNG or GIF sprite first.");
      return;
    }

    const body = new FormData();
    body.set("name", form.name);
    body.set("tweetUrl", form.tweetUrl);
    body.set("lore", form.lore);
    body.set("powers", form.powers);
    body.set("sprite", file);

    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        credentials: "include",
        body,
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Submission failed");
      setForm({ name: "", tweetUrl: "", lore: "", powers: "" });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setMessage("Submitted for admin review.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="section-shell profile-section">
      <div className="section-heading">
        <div>
          <h2>Profile and submission</h2>
          <p>Connect X, link a Solana wallet, then submit a PNG or GIF with its original tweet.</p>
        </div>
      </div>
      <div className="profile-layout">
        <aside className="profile-panel">
          {user ? (
            <>
              <div className="profile-avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <UserRound />}</div>
              <h3>@{user.handle}</h3>
              <p>{user.name}</p>
              <div className="profile-stat">
                <span>Nominations used</span>
                <strong>{user.nominationsUsed}/3</strong>
              </div>
              <div className="profile-stat">
                <span>Payout wallet</span>
                <strong>{shortAddress(user.walletAddress)}</strong>
              </div>
              <button className="primary-button full" onClick={connectWallet}>
                <Wallet size={18} />
                Connect Solana Wallet
              </button>
            </>
          ) : (
            <>
              <Lock size={32} />
              <h3>X account required</h3>
              <p>Connect X to submit sprites and use your 3 contest nominations.</p>
              <button className="primary-button full" onClick={onConnectX}>
                <span className="x-logo-mark" aria-hidden="true">X</span>
                Connect X
              </button>
            </>
          )}
        </aside>
        <form className={formLocked ? "submit-panel locked" : "submit-panel"} onSubmit={submitSprite}>
          {formLocked && (
            <div className="form-lock-banner" id="profile-form-lock">
              <Lock size={18} />
              <span>Connect X before filling out the submission form.</span>
            </div>
          )}
          <div className="submission-rule-banner">
            <ShieldCheck size={20} />
            <div>
              <strong>AI is NOT allowed</strong>
              <span>Submit original human-made sprite art only.</span>
            </div>
          </div>
          <label>
            Sprite name
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
              disabled={formLocked}
              aria-describedby={formLocked ? "profile-form-lock" : undefined}
              maxLength={42}
              placeholder="Vexie"
            />
          </label>
          <label>
            Original tweet link
            <input
              value={form.tweetUrl}
              onChange={(event) => setForm((current) => ({ ...current, tweetUrl: event.target.value }))}
              required
              type="url"
              disabled={formLocked}
              aria-describedby={formLocked ? "profile-form-lock" : undefined}
              placeholder="https://x.com/..."
            />
          </label>
          <label>
            Sprite powers
            <input
              value={form.powers}
              onChange={(event) => setForm((current) => ({ ...current, powers: event.target.value }))}
              required
              disabled={formLocked}
              aria-describedby={formLocked ? "profile-form-lock" : undefined}
              maxLength={140}
              placeholder="Phase blink, shield pulse, tiny decoy trail"
            />
          </label>
          <label className="wide-field">
            More info
            <textarea
              value={form.lore}
              onChange={(event) => setForm((current) => ({ ...current, lore: event.target.value }))}
              required
              disabled={formLocked}
              aria-describedby={formLocked ? "profile-form-lock" : undefined}
              maxLength={500}
              placeholder="Describe the companion, personality, colors, and why it belongs in-game."
            />
          </label>
          <label className={formLocked ? "file-drop locked" : "file-drop"}>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/gif"
              disabled={formLocked}
              aria-describedby={formLocked ? "profile-form-lock" : undefined}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <ImagePlus size={28} />
            <span>{formLocked ? "Connect X to upload" : file ? file.name : "Upload PNG or GIF"}</span>
          </label>
          <button className="primary-button full" disabled={submitting}>
            {formLocked ? <span className="x-logo-mark" aria-hidden="true">X</span> : <Upload size={18} />}
            {formLocked ? "Connect X" : submitting ? "Submitting..." : "Submit Sprite"}
          </button>
          {message && <p className="form-message">{message}</p>}
        </form>
      </div>
    </section>
  );
}

function Admin({ user, pot, reload }: { user: User | null; pot: Pot; reload: () => Promise<void> }) {
  const [potValue, setPotValue] = useState(String(pot.totalUsd));
  const [message, setMessage] = useState("");
  const [reviewStatus, setReviewStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [reviewItems, setReviewItems] = useState<AdminSubmission[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => setPotValue(String(pot.totalUsd)), [pot.totalUsd]);

  const loadReviewQueue = useCallback(async () => {
    if (!user?.isAdmin) return;
    setReviewLoading(true);
    try {
      const response = await fetch(`/api/admin/submissions?status=${reviewStatus}`, { credentials: "include" });
      const payload = (await response.json()) as { submissions?: AdminSubmission[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not load submissions");
      setReviewItems(payload.submissions || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load submissions");
    } finally {
      setReviewLoading(false);
    }
  }, [reviewStatus, user?.isAdmin]);

  useEffect(() => {
    void loadReviewQueue();
  }, [loadReviewQueue]);

  const savePot = async () => {
    setMessage("");
    const response = await fetch("/api/admin/pot", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ totalUsd: Number(potValue) }),
    });
    if (response.ok) {
      setMessage("Pot updated.");
      await reload();
    } else {
      setMessage("Admin update failed.");
    }
  };

  const syncPot = async () => {
    setMessage("");
    const response = await fetch("/api/admin/sync-pot", {
      method: "POST",
      credentials: "include",
    });
    const payload = (await response.json()) as { message?: string; error?: string };
    setMessage(payload.message || payload.error || "Sync attempted.");
    await reload();
  };

  const updateReviewStatus = async (submissionId: string, status: "pending" | "approved" | "rejected", bonusWinner = false) => {
    setMessage("");
    const response = await fetch(`/api/admin/submissions/${submissionId}/status`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, bonusWinner }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setMessage(payload.error || "Submission update failed.");
      return;
    }
    setMessage(status === "approved" ? "Submission approved." : status === "rejected" ? "Submission rejected." : "Submission updated.");
    await Promise.all([reload(), loadReviewQueue()]);
  };

  if (!user?.isAdmin) {
    return (
      <section className="section-shell">
        <div className="locked-admin">
          <ShieldCheck size={42} />
          <h2>Admin locked</h2>
          <p>Only @monarchofct can access review, pot, bonus, and payout export controls.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="section-shell admin-section">
      <div className="section-heading">
        <div>
          <h2>Admin control room</h2>
          <p>Approve submissions, sync the pot wallet, mark bonus winners, and export payout data.</p>
        </div>
        <div className="pool-chip">
          <BadgeCheck size={18} />
          @monarchofct
        </div>
      </div>
      <div className="admin-grid">
        <div className="admin-card">
          <h3>Prize pot</h3>
          <label>
            USD amount
            <input value={potValue} onChange={(event) => setPotValue(event.target.value)} inputMode="decimal" />
          </label>
          <div className="admin-actions">
            <button className="secondary-button" onClick={syncPot}>
              <Gauge size={18} />
              Sync wallet
            </button>
            <button className="primary-button" onClick={savePot}>
              Save pot
            </button>
          </div>
        </div>
        <div className="admin-card admin-card-wide">
          <h3>Pending queue</h3>
          <div className="admin-filter">
            {(["pending", "approved", "rejected", "all"] as const).map((status) => (
              <button
                key={status}
                className={reviewStatus === status ? "active" : ""}
                type="button"
                onClick={() => setReviewStatus(status)}
              >
                {status}
              </button>
            ))}
          </div>
          {reviewLoading ? (
            <p>Loading submissions...</p>
          ) : reviewItems.length ? (
            <div className="review-list">
              {reviewItems.map((submission, index) => (
                <article className="review-item" key={submission.id}>
                  <SpriteAvatar index={index} url={submission.imageUrl} name={submission.name} />
                  <div className="review-copy">
                    <div>
                      <strong>{submission.name}</strong>
                      <span>@{submission.creatorHandle}</span>
                    </div>
                    <p>{submission.powers}</p>
                    <small>{submission.creatorWallet ? shortAddress(submission.creatorWallet) : "No payout wallet yet"}</small>
                  </div>
                  <div className="review-actions">
                    <a href={submission.tweetUrl} target="_blank" rel="noreferrer" className="secondary-button">
                      Tweet
                      <ArrowUpRight size={16} />
                    </a>
                    <button className="secondary-button" type="button" onClick={() => updateReviewStatus(submission.id, "rejected")}>
                      Reject
                    </button>
                    <button className="primary-button" type="button" onClick={() => updateReviewStatus(submission.id, "approved")}>
                      Approve
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => updateReviewStatus(submission.id, "approved", !submission.bonusWinner)}
                    >
                      {submission.bonusWinner ? "Remove bonus" : "Mark bonus"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p>No submissions in this queue yet.</p>
          )}
        </div>
        <div className="admin-card">
          <h3>Payout export</h3>
          <p>Download rank, X handle, wallet, and projected payout CSV for manual payout processing.</p>
          <a className="secondary-button" href="/api/admin/payouts.csv">
            Export CSV
            <ArrowUpRight size={18} />
          </a>
        </div>
      </div>
      {message && <p className="form-message">{message}</p>}
    </section>
  );
}

function App() {
  const { state, setState, reload, loading } = useBootstrap();
  const [activeTab, setActiveTab] = useState("gallery");
  const [showVotePrompt, setShowVotePrompt] = useState(false);
  const [nominationNotice, setNominationNotice] = useState("");
  const [selectedSubmission, setSelectedSubmission] = useState<{ submission: Submission; index: number } | null>(null);
  const pendingNominationIds = useRef(new Set<string>());
  const nominationNoticeTimeoutRef = useRef<number | null>(null);

  const showNominationNotice = useCallback((message: string) => {
    if (nominationNoticeTimeoutRef.current) {
      window.clearTimeout(nominationNoticeTimeoutRef.current);
    }

    setNominationNotice(message);
    nominationNoticeTimeoutRef.current = window.setTimeout(() => {
      setNominationNotice("");
      nominationNoticeTimeoutRef.current = null;
    }, 3200);
  }, []);

  useEffect(() => {
    return () => {
      if (nominationNoticeTimeoutRef.current) window.clearTimeout(nominationNoticeTimeoutRef.current);
    };
  }, []);

  const connectX = () => {
    window.location.href = "/api/auth/x/start";
  };

  const changeTab = (tab: string) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    await reload();
  };

  const nominate = async (id: string) => {
    if (!state.user) {
      setShowVotePrompt(true);
      return false;
    }

    const targetSubmission = state.submissions.find((submission) => submission.id === id);
    if (pendingNominationIds.current.has(id)) {
      return false;
    }

    if (targetSubmission?.nominatedByMe) {
      showNominationNotice("You already nominated this sprite.");
      return false;
    }

    if (state.nominationsRemaining <= 0) {
      showNominationNotice("You already used all 3 nominations.");
      return false;
    }

    pendingNominationIds.current.add(id);

    try {
      const response = await fetch(`/api/submissions/${id}/nominate`, {
        method: "POST",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        showNominationNotice(payload.error || "Could not nominate this sprite.");
        return false;
      }

      setState((current) => ({
        ...current,
        user: current.user
          ? {
              ...current.user,
              nominationsUsed: Math.min(3, current.user.nominationsUsed + 1),
            }
          : current.user,
        submissions: current.submissions.map((submission) =>
          submission.id === id
            ? {
                ...submission,
                nominatedByMe: true,
                nominations: submission.nominations + 1,
              }
            : submission,
        ),
        nominationsRemaining: Math.max(0, current.nominationsRemaining - 1),
      }));

      showNominationNotice("Nomination added.");
      return true;
    } catch {
      showNominationNotice("Could not nominate. Check your connection and try again.");
      return false;
    } finally {
      pendingNominationIds.current.delete(id);
    }
  };

  const onWalletSaved = (walletAddress: string) => {
    setState((current) => ({
      ...current,
      user: current.user ? { ...current.user, walletAddress } : current.user,
    }));
  };

  const submissions = useMemo(
    () => rankSubmissions(state.submissions.length ? state.submissions : fallbackBootstrap.submissions, state.pot.totalUsd),
    [state.pot.totalUsd, state.submissions],
  );
  const selectedLiveSubmission = selectedSubmission
    ? {
        ...selectedSubmission,
        submission:
          submissions.find((submission) => submission.id === selectedSubmission.submission.id) ?? selectedSubmission.submission,
      }
    : null;

  return (
    <>
      <Nav activeTab={activeTab} setActiveTab={changeTab} user={state.user} onConnect={connectX} onLogout={logout} />
      <main className="tab-shell" key={activeTab}>
        <Hero
          pot={state.pot}
          contestEndsAt={state.contestEndsAt}
          activeTab={activeTab}
          setActiveTab={changeTab}
        />
        {loading && <div className="loading-rail">Loading live contest data...</div>}
        {nominationNotice && (
          <div className="nomination-toast" role="status" aria-live="polite">
            {nominationNotice}
          </div>
        )}
        {activeTab === "gallery" && (
          <div className={state.user ? "content-with-rail" : "content-with-rail no-nominations"}>
            <HowItWorksRail setActiveTab={changeTab} />
            <Gallery
              submissions={submissions}
              user={state.user}
              nominationsRemaining={state.nominationsRemaining}
              onNominate={nominate}
              onOpenSubmission={(submission, index) => setSelectedSubmission({ submission, index })}
              setActiveTab={changeTab}
            />
            {state.user && (
              <aside className="nomination-rail" aria-label="Nominations status">
                <NominationMeter nominationsRemaining={state.nominationsRemaining} />
              </aside>
            )}
          </div>
        )}
        {activeTab === "leaderboard" && (
          <Leaderboard
            submissions={submissions}
            pot={state.pot}
            onOpenSubmission={(submission, index) => setSelectedSubmission({ submission, index })}
          />
        )}
        {activeTab === "info" && <InfoPanel pot={state.pot} />}
        {activeTab === "profile" && <Profile user={state.user} onConnectX={connectX} onWalletSaved={onWalletSaved} />}
        {activeTab === "admin" && <Admin user={state.user} pot={state.pot} reload={reload} />}
      </main>
      {selectedLiveSubmission && (
        <SubmissionDetailModal
          submission={selectedLiveSubmission.submission}
          index={selectedLiveSubmission.index}
          canNominate={!state.user || state.nominationsRemaining > 0}
          onClose={() => setSelectedSubmission(null)}
          onNominate={nominate}
        />
      )}
      {showVotePrompt && <ConnectVotePrompt onClose={() => setShowVotePrompt(false)} onConnect={connectX} />}
      <footer className="site-footer">
        <span>SPRITE contest ends July 1, 2026</span>
        <span>Pot wallet sync is wired for Solana RPC once the wallet is added.</span>
      </footer>
    </>
  );
}

const rootElement = document.getElementById("root")!;
const rootHost = rootElement as HTMLElement & { __spriteRoot?: ReturnType<typeof createRoot> };
rootHost.__spriteRoot = rootHost.__spriteRoot ?? createRoot(rootElement);
rootHost.__spriteRoot.render(<App />);
