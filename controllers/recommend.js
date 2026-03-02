const Reservation = require('../models/Reservation');
const CoworkingSpace = require('../models/CoworkingSpace');

//@desc     AI-powered co-working space recommendation
//@route    POST /api/v1/recommend
//@access   Private
exports.getRecommendation = async (req, res, next) => {
    try {
        const pastReservations = await Reservation.find({ user: req.user.id })
            .populate('coworkingSpace', 'name address opentime closetime')
            .sort('-createdAt')
            .limit(10);

        const allSpaces = await CoworkingSpace.find().select('name address tel opentime closetime');

        const historyText = pastReservations.length > 0
            ? pastReservations.map(r => `${r.coworkingSpace?.name || 'Unknown'} on ${r.apptDate}`).join(', ')
            : 'No booking history yet';

        const spacesText = allSpaces.map(s =>
            `${s.name} at ${s.address}, open ${s.opentime}-${s.closetime}`
        ).join('\n');

        const prompt = `You are a co-working space recommender assistant.

User's booking history: ${historyText}

Available co-working spaces:
${spacesText}

Based on the user's booking history and the available spaces, recommend the best space for them.
Reply ONLY with valid JSON in this exact format:
{
  "recommended": "space name here",
  "reason": "brief reason why",
  "alternativeSpaces": ["name1", "name2"]
}`;

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': process.env.BASE_URL || 'http://localhost:5000'
            },
            body: JSON.stringify({
                model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            return res.status(502).json({ success: false, message: 'AI service error', detail: errText });
        }

        const aiData = await response.json();
        const content = aiData.choices?.[0]?.message?.content || '{}';
        const recommendation = JSON.parse(content);

        res.status(200).json({ success: true, data: recommendation });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Could not get recommendation', error: err.message });
    }
};
