const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URL);


const userSchema = new mongoose.Schema({
    username:String,
    name: String,
    email: String,
    password: String,
    profileImage:String,
    posts:[
        {type:mongoose.Schema.Types.ObjectId, ref:"post"}
    ],
})

module.exports = mongoose.model('user', userSchema);
