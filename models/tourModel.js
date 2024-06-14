const mongoose = require('mongoose');
const slugify = require('slugify');

const tourSchema = mongoose.Schema({
    name : {
      type : String ,
      required : [true,"A tour must have a name!"],   //validator
      unique : true,
      trim : true
    },
    slug : {
      type : String
    },
    duration : {
      type : Number,
      required : [true,"A tour must have a duration"]
    },
    maxGroupSize : {
      type : Number,
      required : [true , "A tour must have a group size"]
    },
    difficulty : {
      type : String,
      required : [true , "A tour must have a difficulty"]
    },
    ratingAverage : {
      type : Number,
      default : 4.5
    }, 
    ratingQuantity : {
        type : Number ,
        default : 0,
    },
    price : {
      type : Number,
      required : [true , "A tour must have a price!"]
    },
    priceDiscount : {
      type : Number
    },
    summary : {
      type : String,
      trim : true,
      required : [true , "A tour must have a summary!"]
    },
    description : {
      type : String,
      trim : true
    },
    imageCover: {
      type : String,
      required : [true , 'A tour must have a cover image!']
    },
    image : [String],
    createdAt : {
      type : Date ,
      default : Date.now()
    },
    startDates : [Date],
    secretTour : {
      type : Boolean,
      default : false
    }
  },{
    toJSON : {virtuals : true},
    toObject : {virtuals : true}
  })

  tourSchema.virtual('durationWeeks').get(function(){
    return this.duration/7;
  })

  //DOCUMENT MIDDLEWARE : RUNS BEFORE .save() & .create()
  tourSchema.pre('save' , function(next){
    // console.log(this);
    this.slug = slugify(this.name, {lower : true});
    next();
  });

  // tourSchema.pre('save' , function(next){
  //   console.log("Will save document ..... ");
  //   next();
  // })

  //Document post hook middleware : runs after .save() or .create()
  // tourSchema.post('save',function(doc,next){
  //   console.log(doc);
  //   next();
  // })

  //QUERY MIDDLEWARE FOR METHODS STARTING WITH FIND
  tourSchema.pre(/^find/, function(next){
    // tourSchema.pre('find', function(next){
      this.find({ secretTour : { $ne : true } });
      // console.log(this);
      this.start = Date.now();
      next();
    })


  tourSchema.post(/^find/,function(docs,next){
    console.log(`Query took ${Date.now()-this.start} milliseconds`);
    console.log(docs);
    next();
  })

  //AGGREGATION MIDDLEWARE
  tourSchema.pre('aggregate',function(next){
    console.log(this.pipeline().unshift({ $match : { secretTour : { $ne : true } } }));
    next();
  })

  const Tour = mongoose.model('Tour',tourSchema);

  module.exports = Tour;