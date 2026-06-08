import re
import nltk
from nltk.sentiment.vader import SentimentIntensityAnalyzer
from textblob import TextBlob
from collections import Counter

# Ensure NLTK VADER lexicon is downloaded
try:
    nltk.data.find('sentiment/vader_lexicon.zip')
except LookupError:
    nltk.download('vader_lexicon', quiet=True)

try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt', quiet=True)


# Initialize VADER
sia = SentimentIntensityAnalyzer()

# Emotion Lexicon mapping
EMOTION_LEXICON = {
    'joy': {
        'happy', 'joy', 'love', 'amazing', 'awesome', 'great', 'excited', 'wonderful', 'glad', 
        'positive', 'smile', 'laugh', 'delight', 'cheerful', 'celebrate', 'excellent', 'fantastic', 
        'proud', 'best', 'blessed', 'fun', 'funny', 'haha', 'lol', 'good', 'nice', 'sweet'
    },
    'sadness': {
        'sad', 'sorrow', 'cry', 'tears', 'pain', 'painful', 'hurt', 'depressed', 'unhappy', 
        'grief', 'lonely', 'gloom', 'disappoint', 'disappointed', 'regret', 'tragic', 'weep', 
        'heartbroken', 'worst', 'bad', 'sorry', 'miss', 'losing', 'lost', 'ruined', 'broken'
    },
    'anger': {
        'angry', 'anger', 'mad', 'furious', 'hate', 'annoyed', 'pissed', 'irritate', 'rage', 
        'aggressive', 'hostile', 'offend', 'resent', 'outrage', 'disgust', 'disgusted', 'stupid', 
        'idiot', 'worst', 'hate', 'fake', 'liar', 'cheater', 'trash', 'garbage', 'worst', 'dumb'
    },
    'fear': {
        'fear', 'afraid', 'scared', 'terrify', 'anxiety', 'panic', 'nervous', 'worry', 'dread', 
        'horror', 'threat', 'alarm', 'frightened', 'spooky', 'creepy', 'unsafe', 'scary', 'danger', 
        'dangerous', 'warn', 'warning', 'terror', 'anxious'
    },
    'surprise': {
        'surprise', 'shock', 'amazed', 'astonished', 'unexpected', 'wow', 'wonder', 'sudden', 
        'unbelievable', 'startle', 'incredible', 'insane', 'crazy', 'omg', 'wtf', 'unreal', 
        'unexpectedly', 'revealed', 'shocking', 'surprise'
    }
}

# Emoji mappings to emotions
EMOJI_EMOTIONS = {
    # Joy
    '😂': 'joy', '🤣': 'joy', '😄': 'joy', '😁': 'joy', '😊': 'joy', '😍': 'joy', 
    '🥰': 'joy', '❤️': 'joy', '💖': 'joy', '👍': 'joy', '🥳': 'joy', '🤩': 'joy', 
    '😎': 'joy', '😀': 'joy', '🙂': 'joy', '😋': 'joy', '😻': 'joy', '🎉': 'joy',
    # Sadness
    '😭': 'sadness', '😢': 'sadness', '😞': 'sadness', '😔': 'sadness', '💔': 'sadness', 
    '🥺': 'sadness', '😿': 'sadness', '😭': 'sadness', '😭': 'sadness', '☹️': 'sadness',
    # Anger
    '😡': 'anger', '😠': 'anger', '🤬': 'anger', '👿': 'anger', '🖕': 'anger', 
    '👿': 'anger', '😤': 'anger', '😾': 'anger',
    # Fear
    '😱': 'fear', '😨': 'fear', '😰': 'fear', '😰': 'fear', '👻': 'fear', 
    '💀': 'fear', '😬': 'fear', '😰': 'fear',
    # Surprise
    '😲': 'surprise', '😮': 'surprise', '😳': 'surprise', '🤯': 'surprise', 
    '🌟': 'surprise', '💥': 'surprise', '😮': 'surprise', '😯': 'surprise'
}

# Basic Stopwords list for key phrase extraction
STOPWORDS = {
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', "you're", "you've", "you'll", "you'd",
    'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', "she's", 'her', 'hers',
    'herself', 'it', "it's", 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which',
    'who', 'whom', 'this', 'that', "that'll", 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if',
    'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between',
    'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out',
    'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
    'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
    'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', "don't",
    'should', "should've", 'now', 'd', 'll', 'm', 'o', 're', 've', 'y', 'ain', 'aren', "aren't", 'couldn',
    "couldn't", 'didn', "didn't", 'doesn', "doesn't", 'hadn', "hadn't", 'hasn', "hasn't", 'haven', "haven't",
    'isn', "isn't", 'ma', 'mightn', "mightn't", 'mustn', "mustn't", 'needn', "needn't", 'shan', "shan't",
    'shouldn', "shouldn't", 'wasn', "wasn't", 'weren', "weren't", 'won', "won't", 'wouldn', "wouldn't",
    'the', 'this', 'that', 'but', 'is', 'are', 'was', 'were', 'be', 'to', 'from', 'for'
}

def clean_text(text: str) -> str:
    """Cleans text of raw markdown, double spaces, and normalizes spacing."""
    if not text:
        return ""
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def extract_features(text: str):
    """Extracts hashtags, mentions, and emojis from the text."""
    hashtags = re.findall(r'#\w+', text)
    mentions = re.findall(r'@\w+', text)
    
    # Simple emoji extraction regex
    # Matches typical emoji ranges
    emojis = []
    # Match emoji characters
    for char in text:
        if char in EMOJI_EMOTIONS or (0x1F300 <= ord(char) <= 0x1F9FF) or (0x2600 <= ord(char) <= 0x27BF):
            emojis.append(char)
            
    return {
        'hashtags': hashtags,
        'mentions': mentions,
        'emojis': emojis
    }

def analyze_sentiment_and_emotions(text: str) -> dict:
    """
    Performs comprehensive sentiment and emotion analysis on a given text.
    """
    cleaned = clean_text(text)
    if not cleaned:
        return {
            'text': text,
            'sentiment': 'neutral',
            'scores': {'pos': 0.0, 'neg': 0.0, 'neu': 1.0, 'compound': 0.0},
            'subjectivity': 0.0,
            'emotions': {'joy': 0.0, 'sadness': 0.0, 'anger': 0.0, 'fear': 0.0, 'surprise': 0.0, 'neutral': 1.0},
            'key_phrases': [],
            'hashtags': [],
            'mentions': [],
            'emojis': []
        }

    # 1. Sentiment via NLTK VADER
    vader_scores = sia.polarity_scores(cleaned)
    compound = vader_scores['compound']
    
    if compound >= 0.05:
        sentiment = 'positive'
    elif compound <= -0.05:
        sentiment = 'negative'
    else:
        sentiment = 'neutral'

    # 2. Subjectivity via TextBlob
    try:
        blob = TextBlob(cleaned)
        subjectivity = blob.sentiment.subjectivity
    except Exception:
        subjectivity = 0.5 # Default middle-ground fallback if textblob error

    # 3. Features
    features = extract_features(text)
    
    # 4. Emotion Analyzer (Custom rule-based with modifier weights)
    words = re.findall(r'\b\w+\b', cleaned.lower())
    
    # Initialize emotion counts
    emotion_scores = {'joy': 0.0, 'sadness': 0.0, 'anger': 0.0, 'fear': 0.0, 'surprise': 0.0}
    
    # Calculate word based emotions
    for word in words:
        for emotion, word_set in EMOTION_LEXICON.items():
            if word in word_set:
                emotion_scores[emotion] += 1.0

    # Calculate emoji based emotions
    for emoji in features['emojis']:
        matched_emotion = EMOJI_EMOTIONS.get(emoji)
        if matched_emotion:
            emotion_scores[matched_emotion] += 2.0  # Emojis carry high weight

    # Check for sentence intensifiers (exclamations, capitalization)
    intensity_multiplier = 1.0
    if '!' in text:
        intensity_multiplier += 0.25 * min(text.count('!'), 3)
        
    all_caps_words = sum(1 for w in cleaned.split() if w.isupper() and len(w) > 1)
    if all_caps_words > 0:
        intensity_multiplier += 0.2 * min(all_caps_words, 3)

    # Scale emotion scores
    for emotion in emotion_scores:
        emotion_scores[emotion] *= intensity_multiplier

    # Normalize emotion scores so they represent weights
    total_emotion_score = sum(emotion_scores.values())
    if total_emotion_score > 0:
        # Convert to percentages/fractions
        emotions_normalized = {k: round(v / total_emotion_score, 3) for k, v in emotion_scores.items()}
        emotions_normalized['neutral'] = 0.0
    else:
        # If no explicit emotions detected, map based on sentiment polarity
        if sentiment == 'positive':
            emotions_normalized = {'joy': 0.6, 'sadness': 0.0, 'anger': 0.0, 'fear': 0.0, 'surprise': 0.2, 'neutral': 0.2}
        elif sentiment == 'negative':
            # Balance sadness/anger/fear
            emotions_normalized = {'joy': 0.0, 'sadness': 0.4, 'anger': 0.4, 'fear': 0.1, 'surprise': 0.0, 'neutral': 0.1}
        else:
            emotions_normalized = {'joy': 0.0, 'sadness': 0.0, 'anger': 0.0, 'fear': 0.0, 'surprise': 0.0, 'neutral': 1.0}

    # 5. Key phrases / tags extraction (simple word frequencies of nouns/adjectives/non-stopwords)
    candidate_words = [w for w in words if w not in STOPWORDS and len(w) > 2]
    word_counts = Counter(candidate_words)
    key_phrases = [word for word, count in word_counts.most_common(5)]

    return {
        'text': text,
        'sentiment': sentiment,
        'scores': vader_scores,
        'subjectivity': round(subjectivity, 3),
        'emotions': emotions_normalized,
        'key_phrases': key_phrases,
        'hashtags': features['hashtags'],
        'mentions': features['mentions'],
        'emojis': list(set(features['emojis']))
    }
