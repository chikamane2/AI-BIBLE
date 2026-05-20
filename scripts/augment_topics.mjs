// One-shot: add prayer + declaration to each topic in lib/topics.json.
// Idempotent — re-running just overwrites with the same content.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PATH = resolve(ROOT, "lib/topics.json");

const PRAYERS_DECLARATIONS = {
  "hope": {
    prayer: "Father, when I cannot see a way, You are still the God of hope. Plant hope in me where there is none. Carry me through this dark stretch. I trust You with what comes next. In Jesus' name, amen.",
    declaration: "I am held by the God of hope. He is not finished with my story. Mercies I cannot yet see are already coming to meet me."
  },
  "fear": {
    prayer: "Lord, fear is loud. Be louder. Strengthen me. Hold me up. Drive out the spirit of fear that is not from You. I belong to You — I am not alone in this.",
    declaration: "I will not fear. God is with me. He has given me a spirit of power, of love, and of a sound mind. He upholds me with His righteous right hand."
  },
  "grief": {
    prayer: "Father of all comfort, sit with me in this grief. I do not need to perform; I do not need to hide. You enter every loss. Hold what I cannot hold today. Bring comfort that only You can bring.",
    declaration: "The Lord is near to me — the brokenhearted. He saves the crushed in spirit. He does not despise my tears. I am not alone in this loss."
  },
  "loneliness": {
    prayer: "Lord, You promised to never leave me, never forsake me. Make that promise real to me right now. Fill the silence with Your presence. Be my company in this hour.",
    declaration: "I am not alone. The Lord is with me always, even to the end of the age. He will never leave me, never forsake me."
  },
  "money": {
    prayer: "Father, You are my Provider. I bring You my needs, my fears about provision, my grasping. Free me from the love of money. Supply what I truly need according to Your riches in glory.",
    declaration: "My God supplies all my needs according to His riches in glory in Christ Jesus. I seek first His kingdom; all I need will be added."
  },
  "addiction": {
    prayer: "Lord Jesus, You came to set captives free. Break this chain. I cannot save myself. I run to You. Send help — Your Spirit, Your people, the way of escape You have promised. I will walk in the freedom You bought.",
    declaration: "There is no condemnation for me in Christ Jesus. The Spirit of life has set me free. Whom the Son sets free is free indeed."
  },
  "depression": {
    prayer: "Father, I cannot lift my own head. Be near to me. Hold on to me when I cannot hold on. Your mercies are new every morning — let me feel that, even faintly. Send me the help I need, in You and through Your people.",
    declaration: "Why are you cast down, O my soul? Hope in God; I shall yet praise Him. The Lord is near. He is my help and my God."
  },
  "shame": {
    prayer: "Father, lift my face. The accuser is loud, but the cross is louder. Apply the blood of Jesus to my shame. I receive what He has done for me. I am clean. I am Yours.",
    declaration: "There is no condemnation for me in Christ Jesus. As far as the east is from the west, He has removed my transgressions. I am clean."
  },
  "purpose": {
    prayer: "Father, You knew me before I was formed. You wrote my days in Your book. Show me Your purpose for my life. Use me. Even my smallest faithful step today is part of Your story.",
    declaration: "I am not an accident. I am God's workmanship, created in Christ Jesus for good works that He prepared in advance for me to walk in."
  },
  "love": {
    prayer: "Father, fix Your love over me until it is the loudest thing in my heart. Quiet the voices that say I am not loved. I receive Your love today. Help me love others as You have loved me.",
    declaration: "I am loved with an everlasting love. Nothing can separate me from the love of God in Christ Jesus. He sings over me with joy."
  },
  "salvation": {
    prayer: "Lord Jesus, I confess You as Lord. I believe in my heart that God raised You from the dead. Save me. Forgive my sins. Wash me clean. I am Yours from this day forward.",
    declaration: "Jesus is Lord. I am saved by grace through faith. I have eternal life. I belong to God."
  },
  "peace": {
    prayer: "Lord Jesus, You give peace the world cannot give. Guard my heart and my mind in You. Quiet what is anxious. Settle what is troubled. I receive Your shalom.",
    declaration: "The peace of God, which surpasses all understanding, guards my heart and mind in Christ Jesus. My heart is not troubled, neither is it afraid."
  },
  "strength": {
    prayer: "Lord, I have nothing left. Be my strength. Renew me as I wait on You. Make Your power perfect in this weakness. I do all things through Christ who strengthens me.",
    declaration: "Those who hope in the Lord renew their strength. I will mount up with wings as eagles. I will run and not be weary; I will walk and not faint."
  },
  "forgiveness": {
    prayer: "Father, I confess my sins to You. Forgive me. Cleanse me. And give me grace to forgive those who have wronged me — even when I do not feel like it. Free me from bitterness.",
    declaration: "If I confess my sins, He is faithful and just to forgive me. As I have been forgiven, I forgive others. I walk free."
  },
  "doubt": {
    prayer: "Lord, I believe; help my unbelief. Take my honest doubts and walk them through with me. Strengthen my trust. Help me put what little faith I have onto You — for that is enough.",
    declaration: "Faith the size of a mustard seed in the right hands moves mountains. The size of my faith is not the point. The size of the One I trust is."
  },
  "patience": {
    prayer: "Father, You are not slow. Help me wait well. Teach me to trust Your timing. Use this season for what only it can do in me. I will not grow weary in waiting.",
    declaration: "The Lord is good to those who wait for Him. In due season I will reap, if I do not give up. The wait is not wasted."
  },
  "wisdom": {
    prayer: "Father, I lack wisdom. I ask You — generously and without finding fault — for clarity. Direct my paths. Show me the way I should go. Make my decisions Yours.",
    declaration: "If anyone lacks wisdom, let him ask of God who gives generously. He gives me wisdom. He directs my paths."
  },
  "anger": {
    prayer: "Father, my anger is hot. Cool it. Help me be quick to listen, slow to speak, slow to wrath. Take this heat from me before it becomes sin. Replace it with Your Spirit.",
    declaration: "I will be angry and not sin. I do not let the sun go down on my wrath. The peace of God rules in my heart."
  },
  "prayer": {
    prayer: "Father, teach me to pray. I come now — not with the right words but with an open heart. Listen. Speak. Train me to abide in conversation with You all day long.",
    declaration: "I will pray without ceasing. The effective fervent prayer of a righteous man avails much. My Father hears me."
  },
  "faith": {
    prayer: "Father, increase my faith. Let me hear Your Word until trust grows. Help me walk by faith and not by sight today. I put what I have onto You.",
    declaration: "I walk by faith and not by sight. The just shall live by faith. By faith I overcome the world."
  },
  "trust": {
    prayer: "Lord, I cannot see the way, but I trust You. I take my hands off the wheel. I commit my way to You. Bring it to pass — in Your time, in Your way, by Your power.",
    declaration: "I trust in the Lord with all my heart. I do not lean on my own understanding. He directs my paths."
  },
  "joy": {
    prayer: "Father, restore the joy of my salvation. Joy is in You — not in what I have or do not have. By Your Spirit, fill me with the joy that does not depend on my circumstances.",
    declaration: "The joy of the Lord is my strength. I rejoice in the Lord always. In His presence is fullness of joy."
  },
  "marriage": {
    prayer: "Father, You designed marriage. Heal what is broken. Strengthen what is weak. Help me love my spouse as Christ loved the church. Take selfishness from me. Let our home reflect Yours.",
    declaration: "What God has joined together, no one separates. We will love. We will forgive. We will not give up. Our home belongs to the Lord."
  },
  "parenting": {
    prayer: "Father, my children are Your gift. Help me raise them in Your discipline and instruction. Forgive me when I fail. Reach them with Your love through and around me. Bring them home.",
    declaration: "My children are a heritage from the Lord. I train them up in the way they should go. The Lord is at work in my home."
  },
  "work": {
    prayer: "Lord, I work for You today. Whatever my hands find to do, I do it heartily, as worship. Give me strength, integrity, and grace with those around me. Use my work for Your kingdom.",
    declaration: "Whatever I do, I do it heartily, as for the Lord and not for men. He is my employer. He sees, and He rewards."
  },
  "sickness": {
    prayer: "Father, You are the great Physician. I bring this sickness to You. Heal — if it is Your will. Sustain — if You choose to use this. Be near. Use the doctors and medicine You have provided.",
    declaration: "By His stripes I am healed. The Lord sustains me on my sickbed. His grace is sufficient for me."
  },
  "death": {
    prayer: "Lord Jesus, You are the resurrection and the life. Hold me — or hold the one I love — through this passage. There is a place prepared. We will see You face to face.",
    declaration: "Death is swallowed up in victory. To be absent from the body is to be present with the Lord. I do not grieve as those who have no hope."
  },
  "persecution": {
    prayer: "Father, I do not return evil for evil. I bless those who curse me. Strengthen me to stand. Make me bold and patient like Your servants of old. I trust You with vindication.",
    declaration: "Blessed am I when I am persecuted for righteousness' sake. Great is my reward in heaven. I am more than a conqueror through Him who loved me."
  },
  "temptation": {
    prayer: "Father, lead me not into temptation. Show me the way of escape. Make me quick to take it. Strengthen the Spirit in me against the weakness of my flesh. Keep me from falling.",
    declaration: "No temptation has overtaken me except such as is common to man. God is faithful. He will provide the way of escape. I will walk in it."
  },
  "pride": {
    prayer: "Father, humble me before You have to. Show me where pride is hardening my heart. Forgive me. Teach me the way down — the way of Christ. Give me grace to esteem others above myself.",
    declaration: "God resists the proud but gives grace to the humble. I humble myself under His mighty hand. He will lift me up in due time."
  },
  "gratitude": {
    prayer: "Father, You have been kind. Open my eyes to see Your mercies — large and small. Make my mouth full of praise. Give me a thankful heart, even on hard days.",
    declaration: "In everything I give thanks. The Lord is good; His mercy endures forever. My heart overflows with gratitude."
  },
  "giving": {
    prayer: "Father, loosen my grip on what I hold. Make me a cheerful giver. Show me who needs what You have placed in my hand. I trust You with the giving and the receiving.",
    declaration: "God loves a cheerful giver. As I give, He gives back — pressed down, shaken together, running over."
  },
  "rest": {
    prayer: "Lord Jesus, I come to You weary and heavy laden. Take this load. Give me rest — rest for my body, rest for my soul. Yoke Yourself to me. Carry what I cannot.",
    declaration: "I come to Jesus and He gives me rest. There remains a Sabbath rest for the people of God. I rest in Him."
  },
  "identity": {
    prayer: "Father, tell me again who I am. Not what I have done, not what was done to me — who You say I am. I receive every word. Let it become the truest thing about me.",
    declaration: "I am a new creation in Christ. I am chosen. I am forgiven. I am loved with an everlasting love. I am His."
  },
  "perseverance": {
    prayer: "Father, I am tired. Strengthen me to take the next step. Help me run with endurance, looking unto Jesus. I will not give up. I will finish the race You have set for me.",
    declaration: "I will run with endurance the race set before me. I will not grow weary in well-doing. I will fight the good fight and finish the race."
  }
};

const topics = JSON.parse(readFileSync(PATH, "utf8"));
let added = 0, skipped = 0, missing = [];

for (const [name, t] of Object.entries(topics)) {
  const pd = PRAYERS_DECLARATIONS[name];
  if (!pd) { missing.push(name); continue; }
  t.prayer = pd.prayer;
  t.declaration = pd.declaration;
  added++;
}

writeFileSync(PATH, JSON.stringify(topics, null, 2), "utf8");
console.log(`Updated ${added} topics with prayer + declaration.`);
if (missing.length) console.log(`(no PD content for: ${missing.join(", ")})`);
