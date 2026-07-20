import { db, pool } from "../client";
import {
  users, agreements, escrows, disputes,
  disputeEvidence, arbiters, conversations,
  messages, listings,
} from "../schema";

async function seed() {
  console.log("▶ Seeding database...");

  // ── Users ──────────────────────────────────────────────────────────────────
  const [alice, bob, charlie, arbiterUser] = await db
    .insert(users)
    .values([
      {
        stellarAddress: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
        email: "alice@example.com",
        displayName: "Alice",
        verificationStatus: "verified",
        reputationScore: "95.0000",
      },
      {
        stellarAddress: "GBVVJJWK4K6AHHNS5PJTZQ5TL2RTBPNBVZRFBPBZOBZPN6X5VNGGZ7H",
        email: "bob@example.com",
        displayName: "Bob",
        verificationStatus: "verified",
        reputationScore: "88.0000",
      },
      {
        stellarAddress: "GC2ROYZQH5FTVEPQZF7CAB3MNGQKZZ2YYYQYQ7QNZCJKXZOEVP2ZQJK",
        email: "charlie@example.com",
        displayName: "Charlie",
        verificationStatus: "pending",
        reputationScore: "0.0000",
      },
      {
        stellarAddress: "GDVXG2FMFFSUMMMBIUEMWPZAIU2FNCH7QNGJMWDXPHKE4Y7OFFRQZKB",
        email: "arbiter@example.com",
        displayName: "Expert Arbiter",
        verificationStatus: "verified",
        reputationScore: "99.0000",
      },
    ])
    .returning();

  // ── Arbiter ────────────────────────────────────────────────────────────────
  await db.insert(arbiters).values({
    userId: arbiterUser.id,
    specialisations: "rental,freelance",
    weight: 10,
  });

  // ── Listing (rental reference implementation) ──────────────────────────────
  const [listing] = await db
    .insert(listings)
    .values({
      ownerId: alice.id,
      title: "Cozy 2-Bedroom Apartment in Downtown",
      description: "Modern apartment with great city views.",
      location: "Lagos, Nigeria",
      rentAmount: "800.0000000",
      assetCode: "USDC",
      assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      status: "active",
      amenities: "wifi,parking,gym",
      bedroomCount: "2",
    })
    .returning();

  // ── Agreement ──────────────────────────────────────────────────────────────
  const [agreement] = await db
    .insert(agreements)
    .values({
      vertical: "rental",
      partyA: alice.id,
      partyB: bob.id,
      state: "active",
      terms: {
        listingId: listing.id,
        durationMonths: 12,
        startDate: "2026-08-01",
        depositMonths: 2,
      },
    })
    .returning();

  // ── Escrow ─────────────────────────────────────────────────────────────────
  const [escrow] = await db
    .insert(escrows)
    .values({
      agreementId: agreement.id,
      depositor: bob.id,
      beneficiary: alice.id,
      amount: "1600.0000000",
      assetCode: "USDC",
      assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      state: "funded",
      releaseConditions: "Release on lease end date if no active dispute.",
    })
    .returning();

  // ── Dispute ────────────────────────────────────────────────────────────────
  const [dispute] = await db
    .insert(disputes)
    .values({
      agreementId: agreement.id,
      escrowId: escrow.id,
      claimant: bob.id,
      respondent: alice.id,
      state: "under_review",
      claimSummary: "Landlord has not returned security deposit after 30 days.",
    })
    .returning();

  // ── Dispute Evidence ───────────────────────────────────────────────────────
  await db.insert(disputeEvidence).values({
    disputeId: dispute.id,
    submitter: bob.id,
    contentRef: "ipfs://QmXyz123abc",
    contentHash: "a".repeat(64),
    description: "Bank statement showing deposit transfer",
  });

  // ── Conversation + Messages ────────────────────────────────────────────────
  const [conversation] = await db
    .insert(conversations)
    .values({
      userId: bob.id,
      contextId: dispute.id,
      contextType: "dispute",
      title: "Help with my security deposit dispute",
    })
    .returning();

  await db.insert(messages).values([
    {
      conversationId: conversation.id,
      role: "user",
      content: "I need help filing a dispute for my security deposit.",
    },
    {
      conversationId: conversation.id,
      role: "assistant",
      content:
        "I can help you file a dispute. Can you describe what happened with your security deposit?",
    },
  ]);

  console.log("✅ Seed complete.");
  console.log(`   Users:         ${[alice, bob, charlie, arbiterUser].length}`);
  console.log(`   Agreements:    1`);
  console.log(`   Escrows:       1`);
  console.log(`   Disputes:      1`);
  console.log(`   Listings:      1`);
  console.log(`   Conversations: 1`);
}

seed()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => pool.end());