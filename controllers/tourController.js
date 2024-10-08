const Tour = require('./../models/tourModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');
const multer = require('multer');
const sharp = require('sharp');

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if(file.mimetype.startsWith('image')){
    cb(null, true);
  }else{
    cb(new AppError('Not an image! Please upload only Images!',400), false);
  }
};

const upload = multer({
  storage : multerStorage,
  fileFilter : multerFilter
});

exports.UploadTourImages = upload.fields([
  {name : 'imageCover', maxCount : 1},
  {name : 'images', maxCount : 3}
]);

// upload.single('photo') --> for single image (req.file)
// upload.array('images',5) --> multiple images with same name (req.files)

exports.resizeTourImages = catchAsync(async (req, res, next) => {

  if(!req.files.imageCover || !req.files.images) return next();

  // 1. Cover Image
  // req.files.imageCover[0].filename = `public/img/tours/tour-${req.params.id}-${Date.now()}-cover.jpeg`;
  const imageCoverFilename = `tour-${req.params.id}-${Date.now()}-cover.jpeg`;

  await sharp(req.files.imageCover[0].buffer)
  .resize(2000,1333)
  .toFormat('jpeg')
  .jpeg({ quality : 90})
  .toFile(`public/img/tours/${imageCoverFilename}`);

  req.body.imageCover = imageCoverFilename;

  // 2. Images
  req.body.images = [];
  
  await Promise.all(req.files.images.map(async (file, index) => {

    const filename = `tour-${req.params.id}-${Date.now()}-${index + 1}.jpeg`;

    await sharp(req.files.images[index].buffer)
      .resize(2000,1333)
      .toFormat('jpeg')
      .jpeg({ quality: 90 })
      .toFile(`public/img/tours/${filename}`);
 
    req.body.images.push(filename);      
  }));

  console.log(req.body);
  next();
});


exports.aliasTopTours = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingAverage,price';
  req.query.fields = 'name,ratingAverage,price,difficulty,summary';

  next();
};

//Class for Api features


exports.getAllTours = factory.getAll(Tour);
exports.getTour = factory.getOne(Tour, { path: 'reviews' });
exports.createTour = factory.createOne(Tour);
exports.updateTour = factory.updateOne(Tour);
exports.deleteTour = factory.deleteOne(Tour);


exports.getTourStats = catchAsync(async(req,res, next)=>{

    const stats = await Tour.aggregate([
      {
        $match : { ratingAverage : { $gte : 4.5 } },
      },
      {
        $group : {
          _id : { $toUpper : "$difficulty" } ,
          numTours : { $sum : 1 },
          numRatings : { $sum : "$ratingQuantity" },
          avgRating : { $avg : "$ratingAverage" },
          avgPrice : { $avg : "$price" },
          minPrice : { $min : "$price"},
          maxPrice : { $max : "$price" }
        },
      },
      {
        $sort : {
          avgPrice : 1
        }
      },
      // {
      //   $match : { _id : { $ne : "EASY"}}
      // }  
    ])

    // console.log(stats);

    res.status(200).json({
      status: 'success',
      data: {
        stats,
      },
    });
});


exports.getMonthlyPlan = catchAsync(async (req,res, next) =>{

    const year = req.params.year * 1 ;
    const plan = await Tour.aggregate([
      {
        $unwind : "$startDates"
      },
      {
        $match : {
          startDates : {
            $gte : new Date(`${year}-01-01`),
            $lte : new Date(`${year}-12-31`)
          }
        }
      },
      {
        $group : {
          _id : { $month : "$startDates" },
          numTourStarts : { $sum : 1 },
          tours : { $push : "$name" }
        }
      },
      {
        $addFields : { month : "$_id" }
      },
      {
        $project : { _id : 0 }
      },
      {
        $sort : { numTourStarts : -1 }
      },
      {
        $limit : 12 //displays only 12 docs
      }
    ]);

    res.status(200).json({
      status : 'success',
      data : plan
    })
});

// /tours-within/:distance/center/:latlng/unit/:unit
// /tours-within/233/center/-40,45/unit/mi

exports.getToursWithin = catchAsync(async (req, res, next)=>{
  
  const {distance , latlng , unit } = req.params ;
  const [lat , lng] = latlng.split(',');

  const radius = unit === 'mi' ? distance/3963.2 : distance/6378.1 ;

  if(!lat || !lng){
    return next(new AppError("Please provide latitude and longitude in format lat,lng",400));
  }

    console.log(distance,lat,lng,unit);

    const tours = await Tour.find({
      startLocation : {
        $geoWithin : {
          $centerSphere : [[lng,lat] , radius]
        }
      }
    });

    res.status(200).json({
      status : 'success',
      results : tours.length,
      data : {
        data : tours
      }
    })

  });


  exports.getDistances = catchAsync( async (req, res, next)=>{

    const { latlng , unit } = req.params ;
    const [lat , lng] = latlng.split(',');
    const multiplier = unit === 'mi' ? 0.000621371 : 0.001 ;

  if(!lat || !lng){
    return next(new AppError("Please provide latitude and longitude in format lat,lng",400));
  }

  const distances = await Tour.aggregate([
    {
      $geoNear : {
        near : {
          type : 'Point',
          coordinates : [lng * 1 , lat * 1]
        },
        distanceField : 'distance',
        distanceMultiplier : multiplier
      }
    },
    {
      $project : {
        distance : 1,
        name : 1
      }
    }
  ]);
  

  res.status(200).json({
    status : 'success',
    data : {
      distances
    }
  })

  })