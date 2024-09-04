const mongoose = require('mongoose');

const postSchema =new mongoose.Schema({
    
    title:String,
    content:String,    
   user : {
    type:mongoose.Schema.Types.ObjectId,
    ref:"user"
   },
   date:{
    type:Date,
    default:Date.now
   },
   postImage:{
    type:String,
    default:'default.png'
   },
   likes:[
    {type: mongoose.Schema.Types.ObjectId,
        ref:"user"
    }
   ]
});

module.exports = mongoose.model('post',postSchema);