const { createClient } = require('@supabase/supabase-js');

// ─────────────────────────────────────────────
// PRODUCT REGISTRY
// Add every Gumroad product here as you launch.
// Permalink = slug after /l/ in the Gumroad URL
// ─────────────────────────────────────────────
const PRODUCT_MAP = {
  // ── Subscription products ──────────────────────────────────────────────────
  // purchaseType: 'subscription' → sets subscription_status + plan on profiles
  'recruiteros': {
    name: 'RecruiterOps',
    plan: 'pro',
    app: 'recruiterops',
    purchaseType: 'subscription',
  },
  'instaagent-pro': {
    name: 'InstaContentPro',
    plan: 'pro',
    app: 'instacontentpro',
    purchaseType: 'subscription',
  },
  'solopreneur-ai-roadmap': {
    name: 'SolopreneurAI',
    plan: 'pro',
    app: 'solopreneurai',
    purchaseType: 'subscription',
  },
  'Idea-to-Payment-Validator': {
    name: 'Idea to Payment Validator',
    plan: 'pro',
    app: 'idea-validator',
    purchaseType: 'subscription',
  },

  // ── One-time purchase products ─────────────────────────────────────────────
  // purchaseType: 'one_time' → sets profiles.[accessColumn] = true on sale
  // Refunds set it back to false. Never touches subscription_status.
  'proposalOS': {
    name: 'ProposalOS',
    app: 'proposalos',
    purchaseType: 'one_time',
    accessColumn: 'proposalos_access',
  },

  // Add new products here:
  // Subscription: { name: '...', plan: 'pro', app: '...', purchaseType: 'subscription' }
  // One-time:     { name: '...', app: '...', purchaseType: 'one_time', accessColumn: '[app]_access' }
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const gumroadSellerId = process.env.GUMROAD_SELLER_ID;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfiguration' }) };
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const params = new URLSearchParams(event.body || '');

    const alertType        = params.get('alert_type') || params.get('type') || 'sale';
    const sellerId         = params.get('seller_id');
    const email            = params.get('email')?.toLowerCase().trim();
    const saleId           = params.get('sale_id');
    const subscriberId     = params.get('subscriber_id');
    const productPermalink = params.get('product_permalink') || '';
    const refunded         = params.get('refunded') === 'true';
    const cancelled        = params.get('cancelled') === 'true';

    const product = PRODUCT_MAP[productPermalink] || {
      name: productPermalink || 'Unknown Product',
      plan: 'pro',
      app: 'unknown',
      purchaseType: 'subscription',
    };

    // ALWAYS log raw webhook first
    try {
      await supabase.from('webhook_logs').insert({
        alert_type: alertType,
        email,
        sale_id: saleId,
        raw_payload: event.body,
      });
    } catch (logErr) {
      console.error('webhook_log insert failed:', logErr);
    }

    // Verify seller ID — only enforced if env var is set
    if (gumroadSellerId && sellerId !== gumroadSellerId) {
      console.warn('Unauthorized webhook — seller_id mismatch');
      return { statusCode: 401, body: 'Unauthorized' };
    }

    if (!email || !saleId) {
      return { statusCode: 200, body: JSON.stringify({ success: true, note: 'Ping logged' }) };
    }

    const now = new Date().toISOString();

    // Look up existing profile by email (needed by both handlers)
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email, plan')
      .eq('email', email)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

    // ── ONE-TIME PURCHASE HANDLER ──────────────────────────────────────────
    if (product.purchaseType === 'one_time') {
      const isRefund = refunded || alertType === 'refund';
      const accessValue = !isRefund;

      if (existingProfile) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ [product.accessColumn]: accessValue, gumroad_sale_id: saleId, updated_at: now })
          .eq('id', existingProfile.id);
        if (updateError) throw updateError;
        console.log(`[${product.name}] Set ${product.accessColumn}=${accessValue} for ${email}`);
      } else if (!isRefund) {
        const { error: pendingError } = await supabase
          .from('pending_subscriptions')
          .upsert({ email, plan: 'one_time', gumroad_sale_id: saleId, gumroad_subscriber_id: null, product_permalink: productPermalink });
        if (pendingError) throw pendingError;
        console.log(`[${product.name}] Pending one-time purchase stored for ${email}`);
      }
      return { statusCode: 200, body: JSON.stringify({ success: true, product: product.name, access: accessValue }) };
    }
    
    // ── SUBSCRIPTION HANDLER ───────────────────────────────────────────────
    // Determine subscription status
    let subscriptionStatus;
    if (refunded || cancelled || alertType === 'refund') {
      subscriptionStatus = 'cancelled';
    } else if (alertType === 'subscription_ended') {
      subscriptionStatus = 'expired';
    } else {
      subscriptionStatus = 'active';
    }

    if (existingProfile) {
      const currentPlan = existingProfile.plan || 'pro';

      // Update profile subscription status
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          subscription_status: subscriptionStatus,
          gumroad_sale_id: saleId,
          gumroad_subscriber_id: subscriberId || null,
          plan: subscriptionStatus === 'active' ? product.plan : currentPlan,
          updated_at: now,
        })
        .eq('id', existingProfile.id);

      if (updateError) throw updateError;

      // Product-specific cancellation logic
      if (subscriptionStatus === 'cancelled' || subscriptionStatus === 'expired') {

        // RecruiterOps — archive jobs and candidates on cancel
        if (productPermalink === 'recruiteros') {
          const { data: userJobs } = await supabase
            .from('jobs')
            .select('id')
            .eq('user_id', existingProfile.id)
            .is('archived_at', null);

          if (userJobs && userJobs.length > 0) {
            const jobIds = userJobs.map(j => j.id);
            await supabase.from('jobs').update({ archived_at: now }).in('id', jobIds);
            await supabase.from('candidates').update({ archived_at: now }).in('job_id', jobIds);
            console.log(`[RecruiterOps] Archived ${jobIds.length} jobs for ${email}`);
          }
        }

        // ProposalOS — no extra cleanup needed on cancel
        // if (productPermalink === 'proposalOS') { ... }

        // Add other product cancellation logic here as you grow:
        // if (productPermalink === 'instaagent-pro') { ... }

        await supabase.from('usage_logs').insert({
          customer_id: existingProfile.id,
          product_id: null,
          action: 'subscription_cancelled',
          metadata: { email, sale_id: saleId, product: product.name, app: product.app },
        });

      } else {
        await supabase.from('usage_logs').insert({
          customer_id: existingProfile.id,
          product_id: null,
          action: 'subscription_activated',
          metadata: { email, sale_id: saleId, product: product.name, app: product.app, alert_type: alertType },
        });
      }

      console.log(`[${product.name}] Updated profile for ${email} → ${subscriptionStatus}`);

    } else {
      // User hasn't registered yet — hold in pending_subscriptions
      if (subscriptionStatus === 'active') {
        const { error: pendingError } = await supabase
          .from('pending_subscriptions')
          .upsert({
            email,
            plan: product.plan,
            gumroad_sale_id: saleId,
            gumroad_subscriber_id: subscriberId || null,
          });

        if (pendingError) throw pendingError;
        console.log(`[${product.name}] Pending subscription stored for ${email}`);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, status: subscriptionStatus, product: product.name }),
    };

  } catch (error) {
    console.error('Webhook error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
};