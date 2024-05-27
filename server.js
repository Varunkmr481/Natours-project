const mongoose = require('mongoose');
const dotenv = require('dotenv');
const app = require('./app');

dotenv.config({ path: './config.env' });
// console.log(process.env);

const DB = process.env.DATABASE.replace('<PASSWORD>',process.env.DATABASE_PASSWORD);

mongoose
// .connect(process.env.DATABASE_LOCAL
.connect(DB,{
  useUnifiedTopology : true,
  useNewUrlParser : true,
  useCreateIndex : true,
  useFindAndModify : false
}).then(() =>{
  // console.log(con.connection);
  console.log('DB Connection successful !');
})

const tourSchema = mongoose.Schema({
  name : {
    type : String ,
    required : [true,"A tour must have a name!"],   //validator
    unique : true
  },
  rating : {
    type : Number,
    default : 4.5
  }, 
  price : {
    type : Number,
    required : [true , "A tour must have a price!"]
  }
})

const Tour = mongoose.model('Tour',tourSchema);
  

// SERVER START
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`App running on port Number : ${port}`);
});
