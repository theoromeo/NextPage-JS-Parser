import Informational from "../util/Informational";

const ImageView = 
{
    name: "image",    
    default: "img:first-of-type",
    
    tagged:function(node)
    {
        const element = node.querySelector(`[${Informational.img}]`)

        if(!element)
        return false

        const attributeValue = element.getAttribute(Informational.img)
        const elementValue = element.getAttribute('src')

        if(attributeValue != Informational.img)
        return {result:attributeValue,view:this.name}

        if(elementValue)
        return {result:elementValue,view:this.name}

        return false
    }

}

export default ImageView