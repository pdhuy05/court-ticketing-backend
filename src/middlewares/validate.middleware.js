/**
 * Middleware validate dữ liệu đầu vào
 * @param {Joi.Schema} schema - Schema Joi để validate
 * @param {string} property - Thuộc tính của request cần validate (body, query, params)
 * @returns {Function} Express middleware function
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const data = req[property] ?? {};
    
    const { error, value } = schema.validate(data, {
      abortEarly: false, 
      stripUnknown: true 
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }

    req[property] = value;
    
    next();
  };
};

module.exports = validate;
